export default function Modal({ titulo, onCerrar, children, pie }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 print:hidden"
      onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 min-h-0 overflow-y-auto">{children}</div>
        {pie && <div className="px-5 py-4 border-t border-gray-200 shrink-0">{pie}</div>}
      </div>
    </div>
  )
}
