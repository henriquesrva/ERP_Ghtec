/**
 * Modal de confirmação para ações destrutivas.
 *
 * Uso:
 *   {confirm && (
 *     <ConfirmModal
 *       title="Excluir item"
 *       message="Deseja excluir <strong>X</strong>? Esta ação não pode ser desfeita."
 *       onConfirm={handleConfirm}
 *       onCancel={() => setConfirm(null)}
 *       confirmLabel="Excluir"   // opcional, default "Excluir"
 *     />
 *   )}
 */
export default function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Excluir',
}) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {/* message pode conter HTML simples como <strong> e <small> */}
        <p dangerouslySetInnerHTML={{ __html: message }} />
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
