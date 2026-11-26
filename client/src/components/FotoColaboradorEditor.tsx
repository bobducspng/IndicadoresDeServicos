import { useEffect, useRef, useState } from "react";
import { Loader2, X, ZoomIn } from "lucide-react";
import {
  FOTO_LADO_PX,
  FOTO_ZOOM_MAX,
  calcularRecorte,
  deslocamentoAposArrasto,
} from "@/lib/colaboradores";

const TAMANHO_PREVIA = 240;
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const LIMITE_ARQUIVO_BYTES = 12 * 1024 * 1024;

interface Props {
  nome: string;
  arquivo: File;
  onCancelar: () => void;
  onSalvar: (dataUrl: string) => Promise<void>;
}

/** Janela de ajuste da foto: arraste para enquadrar, use o controle para ampliar e salve. */
export function FotoColaboradorEditor({ nome, arquivo, onCancelar, onSalvar }: Props) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [erro, setErro] = useState("");
  const [zoom, setZoom] = useState(1);
  const [desloc, setDesloc] = useState({ x: 0, y: 0 });
  const [salvando, setSalvando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      setErro("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (arquivo.size > LIMITE_ARQUIVO_BYTES) {
      setErro("A imagem é muito grande (máximo 12 MB).");
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => setImagem(img);
    img.onerror = () => setErro("Não foi possível abrir essa imagem.");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const desenhar = (canvas: HTMLCanvasElement, lado: number) => {
    if (!imagem) return;
    const contexto = canvas.getContext("2d");
    if (!contexto) return;
    const recorte = calcularRecorte(imagem.naturalWidth, imagem.naturalHeight, zoom, desloc.x, desloc.y);
    canvas.width = lado;
    canvas.height = lado;
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, lado, lado);
    contexto.imageSmoothingQuality = "high";
    contexto.drawImage(imagem, recorte.sx, recorte.sy, recorte.lado, recorte.lado, 0, 0, lado, lado);
  };

  useEffect(() => {
    if (canvasRef.current) desenhar(canvasRef.current, TAMANHO_PREVIA * 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagem, zoom, desloc]);

  const aoArrastar = (evento: React.PointerEvent<HTMLDivElement>) => {
    if (!arrasto.current || !imagem) return;
    const dx = evento.clientX - arrasto.current.x;
    const dy = evento.clientY - arrasto.current.y;
    arrasto.current = { x: evento.clientX, y: evento.clientY };
    const { naturalWidth: largura, naturalHeight: altura } = imagem;
    const lado = Math.min(largura, altura) / zoom;
    setDesloc((atual) => ({
      x: deslocamentoAposArrasto(atual.x, dx, TAMANHO_PREVIA, largura, lado),
      y: deslocamentoAposArrasto(atual.y, dy, TAMANHO_PREVIA, altura, lado),
    }));
  };

  const salvar = async () => {
    if (!imagem) return;
    setSalvando(true);
    setErro("");
    try {
      const saida = document.createElement("canvas");
      desenhar(saida, FOTO_LADO_PX);
      await onSalvar(saida.toDataURL("image/jpeg", 0.88));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a foto.");
      setSalvando(false);
    }
  };

  return (
    <div className="foto-editor-backdrop" role="dialog" aria-modal="true" aria-label={`Ajustar foto de ${nome}`} onPointerDown={(e) => { if (e.target === e.currentTarget && !salvando) onCancelar(); }}>
      <div className="foto-editor">
        <header>
          <strong>Foto de {nome}</strong>
          <button type="button" className="collab-icon-button" onClick={onCancelar} disabled={salvando} aria-label="Fechar"><X size={15} /></button>
        </header>

        {erro && !imagem ? (
          <p className="foto-editor-erro" role="alert">{erro}</p>
        ) : !imagem ? (
          <p className="collab-empty">Carregando imagem…</p>
        ) : (
          <>
            <div
              className="foto-editor-area"
              style={{ width: TAMANHO_PREVIA, height: TAMANHO_PREVIA }}
              onPointerDown={(e) => { arrasto.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={aoArrastar}
              onPointerUp={() => { arrasto.current = null; }}
              onPointerCancel={() => { arrasto.current = null; }}
            >
              <canvas ref={canvasRef} style={{ width: TAMANHO_PREVIA, height: TAMANHO_PREVIA }} aria-label="Prévia da foto" />
            </div>
            <p className="foto-editor-dica">Arraste para enquadrar. A foto aparece em formato redondo.</p>
            <label className="foto-editor-zoom">
              <ZoomIn size={14} />
              <input type="range" min={1} max={FOTO_ZOOM_MAX} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Ampliar" />
            </label>
            {erro && <p className="foto-editor-erro" role="alert">{erro}</p>}
          </>
        )}

        <footer>
          <button type="button" className="collab-ghost-button" onClick={onCancelar} disabled={salvando}>Cancelar</button>
          <button type="button" className="collab-chat-button" onClick={salvar} disabled={!imagem || salvando}>
            {salvando ? <><Loader2 size={14} className="foto-editor-spin" /> Salvando…</> : "Salvar foto"}
          </button>
        </footer>
      </div>
    </div>
  );
}
