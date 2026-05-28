import { useState, useEffect, useCallback } from 'react';
import {
  listUsers,
  createUser,
  changeUserRole,
  deleteUser,
  changePassword,
  updateSignature,
} from '../api/users';
import Toast        from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import useAuth      from '../hooks/useAuth';

/**
 * Usuarios.jsx
 *
 * Preserva:
 *  - GET /users (admin: tabela com role select + delete)
 *  - POST /users (criar usuário — admin only)
 *  - PUT /users/:id/role (alterar role — admin only, save por linha)
 *  - DELETE /users/:id (excluir — admin only, ConfirmModal, desabilitado para o próprio)
 *  - PUT /users/me/password (trocar senha — todos os usuários)
 *  - PUT /users/me/signature (assinatura — todos os usuários, pré-populada do AuthContext)
 *  - Regras: admin-only para gestão, todos podem alterar senha/assinatura
 */

const ROLES = ['user', 'comercial', 'tecnico', 'financeiro', 'admin'];

const ROLE_STYLE = {
  admin:      { bg: '#e8f5e9', color: '#1b5e20', border: '#a5d6a7' },
  user:       { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' },
  comercial:  { bg: '#fff8e1', color: '#e65100', border: '#ffcc80' },
  tecnico:    { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8' },
  financeiro: { bg: '#e0f2f1', color: '#00695c', border: '#80cbc4' },
};

function RoleBadge({ role }) {
  const s = ROLE_STYLE[role] || ROLE_STYLE.user;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {role}
    </span>
  );
}

function InlineMsg({ msg }) {
  if (!msg.text) return null;
  return (
    <div className={`msg ${msg.type}`} style={{ marginTop: '10px', fontSize: '13px', padding: '8px 12px', borderRadius: 'var(--radius)' }}>
      {msg.text}
    </div>
  );
}

function fmtDate(str) {
  if (!str) return '—';
  return str.substring(0, 10).split('-').reverse().join('/');
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Usuarios() {
  const { user: me, login } = useAuth();
  const isAdmin = me?.role === 'admin';

  // ── Tabela de usuários ────────────────────────────────────────────────────
  const [users,        setUsers]        = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersErr,     setUsersErr]     = useState('');
  const [pendingRoles, setPendingRoles] = useState({}); // { [id]: role }
  const [savingRole,   setSavingRole]   = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, nome }
  const [toast,        setToast]        = useState({ message: '', type: 'success' });

  // ── Criar usuário ─────────────────────────────────────────────────────────
  const [newNome,     setNewNome]     = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole,     setNewRole]     = useState('user');
  const [creating,    setCreating]    = useState(false);
  const [createMsg,   setCreateMsg]   = useState({ text: '', type: '' });

  // ── Trocar senha ─────────────────────────────────────────────────────────
  const [pwdCurrent,   setPwdCurrent]   = useState('');
  const [pwdNew,       setPwdNew]       = useState('');
  const [pwdConfirm,   setPwdConfirm]   = useState('');
  const [changingPwd,  setChangingPwd]  = useState(false);
  const [pwdMsg,       setPwdMsg]       = useState({ text: '', type: '' });

  // ── Assinatura ───────────────────────────────────────────────────────────
  const [sigCargo,    setSigCargo]    = useState('');
  const [sigTelefone, setSigTelefone] = useState('');
  const [savingSig,   setSavingSig]   = useState(false);
  const [sigMsg,      setSigMsg]      = useState({ text: '', type: '' });

  // Pré-popula assinatura do usuário logado (vem do AuthContext)
  useEffect(() => {
    if (me) {
      setSigCargo(me.signature_cargo || '');
      setSigTelefone(me.signature_telefone || '');
    }
  }, [me?.id]); // eslint-disable-line

  // ── Carregar usuários ─────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersErr('');
    try {
      const data = await listUsers();
      setUsers(data);
      setPendingRoles({});
    } catch {
      setUsersErr('Erro ao carregar usuários.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  // ── Alterar role ──────────────────────────────────────────────────────────
  async function handleSaveRole(id) {
    const role = pendingRoles[id];
    if (!role) return;
    setSavingRole(id);
    try {
      await changeUserRole(id, role);
      setPendingRoles(prev => { const n = { ...prev }; delete n[id]; return n; });
      setToast({ message: 'Perfil alterado com sucesso.', type: 'success' });
      loadUsers();
    } catch (err) {
      setToast({ message: err.message || 'Erro ao alterar perfil.', type: 'error' });
      setPendingRoles(prev => { const n = { ...prev }; delete n[id]; return n; });
    } finally {
      setSavingRole(null);
    }
  }

  // ── Excluir usuário ───────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteConfirm) return;
    const { id, nome } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteUser(id);
      setToast({ message: `Usuário "${nome}" excluído.`, type: 'success' });
      loadUsers();
    } catch (err) {
      setToast({ message: err.message || 'Erro ao excluir usuário.', type: 'error' });
    }
  }

  // ── Criar usuário ─────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setCreateMsg({ text: '', type: '' });
    setCreating(true);
    try {
      const data = await createUser({ nome: newNome.trim(), username: newUsername.trim(), password: newPassword, role: newRole });
      const created = data.user ?? data;
      setCreateMsg({ text: `Usuário "${created.nome}" criado com sucesso.`, type: 'success' });
      setNewNome(''); setNewUsername(''); setNewPassword(''); setNewRole('user');
      loadUsers();
    } catch (err) {
      setCreateMsg({ text: err.message || 'Erro ao criar usuário.', type: 'error' });
    } finally {
      setCreating(false);
    }
  }

  // ── Trocar senha ──────────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdMsg({ text: '', type: '' });
    if (pwdNew !== pwdConfirm) {
      setPwdMsg({ text: 'A nova senha e a confirmação não coincidem.', type: 'error' });
      return;
    }
    setChangingPwd(true);
    try {
      await changePassword(pwdCurrent, pwdNew);
      setPwdMsg({ text: 'Senha alterada com sucesso.', type: 'success' });
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
    } catch (err) {
      setPwdMsg({ text: err.message || 'Erro ao alterar senha.', type: 'error' });
    } finally {
      setChangingPwd(false);
    }
  }

  // ── Salvar assinatura ─────────────────────────────────────────────────────
  async function handleSaveSignature(e) {
    e.preventDefault();
    setSigMsg({ text: '', type: '' });
    setSavingSig(true);
    try {
      const res = await updateSignature(sigCargo.trim(), sigTelefone.trim());
      setSigMsg({ text: 'Assinatura salva com sucesso.', type: 'success' });
      // Atualiza AuthContext para refletir na criação de propostas
      if (me && login) {
        login({ ...me, signature_cargo: res.signature_cargo ?? sigCargo.trim(), signature_telefone: res.signature_telefone ?? sigTelefone.trim() });
      }
    } catch (err) {
      setSigMsg({ text: err.message || 'Erro ao salvar assinatura.', type: 'error' });
    } finally {
      setSavingSig(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-bar">
        <div>
          <h1>Gerenciamento de Usuários</h1>
          <span>Cadastro e controle de acesso ao sistema</span>
        </div>
      </div>

      <div className="container">
        {isAdmin ? (
          /* ── Layout admin: split ───────────────────────────────────── */
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* Esquerda: criar usuário */}
            <div className="card">
              <div className="card-title">Novo Usuário</div>
              <form onSubmit={handleCreate} noValidate>

                <div className="field" style={{ marginBottom: '12px' }}>
                  <label>Nome completo *</label>
                  <input type="text" value={newNome} onChange={e => setNewNome(e.target.value)}
                    placeholder="Ex: João Silva" autoComplete="off" disabled={creating} />
                </div>

                <div className="field" style={{ marginBottom: '12px' }}>
                  <label>Nome de usuário *</label>
                  <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                    placeholder="Ex: joao.silva" autoComplete="off" autoCapitalize="none" disabled={creating} />
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px', display: 'block' }}>
                    Sem espaços. Será usado para fazer login.
                  </span>
                </div>

                <div className="field" style={{ marginBottom: '12px' }}>
                  <label>Senha *</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" autoComplete="new-password" disabled={creating} />
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label>Perfil</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    disabled={creating}
                    style={{ padding: '8px 10px', border: '1px solid #ccc', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'inherit', background: '#fff', width: '100%' }}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <InlineMsg msg={createMsg} />

                <div style={{ marginTop: '16px' }}>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Salvando...' : 'Criar usuário'}
                  </button>
                </div>
              </form>
            </div>

            {/* Direita: tabela + senha + assinatura */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <UsersTable
                users={users}
                loading={usersLoading}
                error={usersErr}
                currentUserId={me?.id}
                pendingRoles={pendingRoles}
                savingRole={savingRole}
                onRoleChange={(id, role) => setPendingRoles(prev => ({ ...prev, [id]: role }))}
                onSaveRole={handleSaveRole}
                onDeleteClick={(id, nome) => setDeleteConfirm({ id, nome })}
                onRetry={loadUsers}
              />
              <PasswordCard
                pwdCurrent={pwdCurrent} setPwdCurrent={setPwdCurrent}
                pwdNew={pwdNew} setPwdNew={setPwdNew}
                pwdConfirm={pwdConfirm} setPwdConfirm={setPwdConfirm}
                changingPwd={changingPwd} pwdMsg={pwdMsg}
                onSubmit={handleChangePassword}
              />
              <SignatureCard
                sigCargo={sigCargo} setSigCargo={setSigCargo}
                sigTelefone={sigTelefone} setSigTelefone={setSigTelefone}
                savingSig={savingSig} sigMsg={sigMsg}
                onSubmit={handleSaveSignature}
              />
            </div>
          </div>

        ) : (
          /* ── Layout não-admin: apenas senha + assinatura ────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px' }}>
            <PasswordCard
              pwdCurrent={pwdCurrent} setPwdCurrent={setPwdCurrent}
              pwdNew={pwdNew} setPwdNew={setPwdNew}
              pwdConfirm={pwdConfirm} setPwdConfirm={setPwdConfirm}
              changingPwd={changingPwd} pwdMsg={pwdMsg}
              onSubmit={handleChangePassword}
            />
            <SignatureCard
              sigCargo={sigCargo} setSigCargo={setSigCargo}
              sigTelefone={sigTelefone} setSigTelefone={setSigTelefone}
              savingSig={savingSig} sigMsg={sigMsg}
              onSubmit={handleSaveSignature}
            />
          </div>
        )}
      </div>

      {/* Confirm excluir */}
      {deleteConfirm && (
        <ConfirmModal
          title="Excluir usuário"
          message={`Deseja excluir <strong>${deleteConfirm.nome}</strong>? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(t => ({ ...t, message: '' }))}
      />
    </>
  );
}

// ── Sub-componente: tabela de usuários ────────────────────────────────────────
function UsersTable({ users, loading, error, currentUserId, pendingRoles, savingRole, onRoleChange, onSaveRole, onDeleteClick, onRetry }) {
  return (
    <div className="card">
      <div className="card-title">Usuários cadastrados</div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '20px 0', fontSize: '13px' }}>Carregando...</div>}
      {error && !loading && (
        <div style={{ textAlign: 'center', color: 'var(--color-danger)', padding: '16px 0', fontSize: '13px' }}>
          {error}
          <br />
          <button className="btn btn-ghost btn-sm" style={{ marginTop: '8px' }} onClick={onRetry}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Criado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0
              ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '24px' }}>
                    Nenhum usuário.
                  </td>
                </tr>
              )
              : users.map(u => {
                const pending      = pendingRoles[u.id];
                const currentRole  = pending ?? u.role;
                const isDirty      = pending !== undefined && pending !== u.role;
                const isSaving     = savingRole === u.id;
                const isSelf       = u.id === currentUserId;

                return (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td style={{ fontFamily: 'monospace' }}>{u.username}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <select
                          value={currentRole}
                          onChange={e => onRoleChange(u.id, e.target.value)}
                          disabled={isSaving}
                          style={{
                            fontSize: '12px', fontFamily: 'inherit', padding: '3px 6px',
                            border: '1px solid #ccc', borderRadius: 'var(--radius)',
                            background: '#fff', cursor: 'pointer',
                          }}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {isDirty && (
                          <button
                            onClick={() => onSaveRole(u.id)}
                            disabled={isSaving}
                            style={{
                              fontSize: '11px', fontWeight: 700, padding: '3px 9px',
                              border: '1px solid var(--color-primary-light, #81c784)',
                              borderRadius: 'var(--radius)',
                              background: 'var(--color-primary-bg, #f1f8e9)',
                              color: 'var(--color-primary, #2e7d32)', cursor: 'pointer',
                            }}
                          >
                            {isSaving ? '...' : 'Salvar'}
                          </button>
                        )}
                        {!isDirty && <RoleBadge role={u.role} />}
                      </div>
                    </td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => !isSelf && onDeleteClick(u.id, u.nome)}
                        disabled={isSelf}
                        title={isSelf ? 'Não é possível excluir o próprio usuário' : 'Excluir usuário'}
                        style={{
                          padding: '3px 8px', fontSize: '11px', fontWeight: 700,
                          border: '1px solid #ef9a9a', borderRadius: 'var(--radius)',
                          background: '#fff', color: 'var(--color-danger)',
                          cursor: isSelf ? 'not-allowed' : 'pointer',
                          opacity: isSelf ? 0.4 : 1,
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Sub-componente: trocar senha ──────────────────────────────────────────────
function PasswordCard({ pwdCurrent, setPwdCurrent, pwdNew, setPwdNew, pwdConfirm, setPwdConfirm, changingPwd, pwdMsg, onSubmit }) {
  return (
    <div className="card">
      <div className="card-title">Trocar minha senha</div>
      <form onSubmit={onSubmit} noValidate>
        <div className="field" style={{ marginBottom: '12px' }}>
          <label>Senha atual</label>
          <input type="password" value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)}
            autoComplete="current-password" disabled={changingPwd} />
        </div>
        <div className="field" style={{ marginBottom: '12px' }}>
          <label>Nova senha</label>
          <input type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)}
            placeholder="Mínimo 6 caracteres" autoComplete="new-password" disabled={changingPwd} />
        </div>
        <div className="field" style={{ marginBottom: '4px' }}>
          <label>Confirmar nova senha</label>
          <input type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)}
            autoComplete="new-password" disabled={changingPwd} />
        </div>
        <InlineMsg msg={pwdMsg} />
        <div style={{ marginTop: '16px' }}>
          <button type="submit" className="btn btn-primary" disabled={changingPwd}>
            {changingPwd ? 'Salvando...' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Sub-componente: assinatura ────────────────────────────────────────────────
function SignatureCard({ sigCargo, setSigCargo, sigTelefone, setSigTelefone, savingSig, sigMsg, onSubmit }) {
  return (
    <div className="card">
      <div className="card-title">Minha Assinatura</div>
      <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 14px' }}>
        Estes dados aparecem automaticamente nas propostas que você gerar.
      </p>
      <form onSubmit={onSubmit} noValidate>
        <div className="field" style={{ marginBottom: '12px' }}>
          <label>Cargo</label>
          <input type="text" value={sigCargo} onChange={e => setSigCargo(e.target.value)}
            placeholder="Ex: Consultor Comercial" autoComplete="off" disabled={savingSig} />
        </div>
        <div className="field" style={{ marginBottom: '4px' }}>
          <label>Telefone</label>
          <input type="text" value={sigTelefone} onChange={e => setSigTelefone(e.target.value)}
            placeholder="Ex: (31) 99999-9999" autoComplete="off" disabled={savingSig} />
        </div>
        <InlineMsg msg={sigMsg} />
        <div style={{ marginTop: '16px' }}>
          <button type="submit" className="btn btn-primary" disabled={savingSig}>
            {savingSig ? 'Salvando...' : 'Salvar assinatura'}
          </button>
        </div>
      </form>
    </div>
  );
}
