import React, { useState, useRef, useEffect } from 'react';
import { CTE, Note, Attachment } from '../types';
import { sendNoteToScript, fetchNotesForCte } from '../services/api';
import { X, Paperclip, Send, AlertTriangle, Check, Loader2, User, AlertCircle, FileText, Camera, Image as ImageIcon, FileAudio, FileVideo, FileSpreadsheet, File } from 'lucide-react';

interface NoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    cte: CTE | null;
    currentUser: string;
    onNoteAdded?: () => Promise<void>;
}

// Subcomponente para gerenciar o preview do anexo e erros de carregamento
const AttachmentThumbnail = ({ att }: { att: any }) => {
    const [hasError, setHasError] = useState(false);
    
    // Normaliza mimetype e nome
    const mime = (att.mimeType || '').toLowerCase();
    const name = att.name || 'Anexo';
    let previewSrc = att.data;

    // LÓGICA DE CORREÇÃO PARA GOOGLE DRIVE
    // Links de visualização padrão (/file/d/.../view) geralmente não carregam em tags <img> devido a CORS/X-Frame.
    // Convertemos para a API de Thumbnail que é feita para embeds.
    if (!hasError && typeof previewSrc === 'string' && previewSrc.includes('google.com') && !previewSrc.startsWith('data:')) {
        try {
            // Tenta extrair o ID do arquivo (padrão de 25+ caracteres alfanuméricos)
            const idMatch = previewSrc.match(/[-\w]{25,}/);
            if (idMatch) {
                // sz=w400 solicita um thumbnail de 400px de largura (bom balanço qualidade/performance)
                previewSrc = `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=w400`;
            }
        } catch (e) {
            // Se falhar a conversão, usa a URL original
        }
    }

    // 1. PDF
    if (mime.includes('pdf')) {
        return (
            <div className="flex flex-col items-center justify-center w-20 h-20 bg-red-50 text-red-600">
                <FileText size={24} />
                <span className="text-[8px] mt-1 font-medium px-1 truncate w-full text-center" title={name}>{name}</span>
            </div>
        );
    }

    // 2. Word / Documentos
    if (mime.includes('word') || mime.includes('document') || mime.includes('msword')) {
        return (
            <div className="flex flex-col items-center justify-center w-20 h-20 bg-blue-50 text-blue-600">
                <FileText size={24} />
                <span className="text-[8px] mt-1 font-medium px-1 truncate w-full text-center" title={name}>DOC</span>
            </div>
        );
    }

    // 3. Excel / Planilhas
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) {
        return (
            <div className="flex flex-col items-center justify-center w-20 h-20 bg-emerald-50 text-emerald-600">
                <FileSpreadsheet size={24} />
                <span className="text-[8px] mt-1 font-medium px-1 truncate w-full text-center" title={name}>XLS</span>
            </div>
        );
    }

    // 4. Áudio
    if (mime.includes('audio')) {
        return (
            <div className="flex flex-col items-center justify-center w-20 h-20 bg-purple-50 text-purple-600">
                <FileAudio size={24} />
                <span className="text-[8px] mt-1 font-medium px-1 truncate w-full text-center" title={name}>Áudio</span>
            </div>
        );
    }

    // 5. Vídeo
    if (mime.includes('video')) {
        return (
            <div className="flex flex-col items-center justify-center w-20 h-20 bg-pink-50 text-pink-600">
                <FileVideo size={24} />
                <span className="text-[8px] mt-1 font-medium px-1 truncate w-full text-center" title={name}>Vídeo</span>
            </div>
        );
    }

    // 6. Arquivo Genérico (se não for imagem explícita e não tiver preview)
    if (!mime.includes('image') && mime !== '') {
        return (
            <div className="flex flex-col items-center justify-center w-20 h-20 bg-gray-100 text-gray-600">
                <File size={24} />
                <span className="text-[8px] mt-1 font-medium px-1 truncate w-full text-center" title={name}>Arquivo</span>
            </div>
        );
    }

    // 7. Fallback para Imagem com Erro (ex: link quebrado ou bloqueio do Drive persistente)
    if (hasError) {
        return (
            <div className="flex flex-col items-center justify-center w-20 h-20 bg-gray-50 text-gray-400 border border-dashed border-gray-300">
                <ImageIcon size={24} />
                <span className="text-[8px] mt-1 text-gray-400 px-1 truncate w-full text-center">Abrir</span>
            </div>
        );
    }

    // 8. Tenta renderizar imagem (usando a URL otimizada de thumbnail se aplicável)
    return (
        <img 
            src={previewSrc} 
            alt="Anexo" 
            className="w-20 h-20 object-cover" 
            onError={() => setHasError(true)} 
        />
    );
};

const NoteModal: React.FC<NoteModalProps> = ({ isOpen, onClose, cte, currentUser, onNoteAdded }) => {
    const [text, setText] = useState('');
    const [isSearch, setIsSearch] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [history, setHistory] = useState<Note[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const historyEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && cte) {
            setSuccessMsg('');
            setErrorMsg('');
            setText('');
            setAttachments([]);
            setLoadingStep('');
            setIsSearch(cte.isSearch || false);
            setHistory([]);
            setLoading(false);
            
            const loadHistory = async () => {
                setLoadingHistory(true);
                try {
                    const fetchedNotes = await fetchNotesForCte(cte.id, cte.cteNumber);
                    setHistory(fetchedNotes);
                } catch (e) {
                    console.error("Erro ao carregar notas", e);
                } finally {
                    setLoadingHistory(false);
                }
            };
            loadHistory();
        }
    }, [isOpen, cte]);

    useEffect(() => {
        if (isOpen && historyEndRef.current) {
            historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isOpen, history]);

    if (!isOpen || !cte) return null;

    const handleAttachmentClick = () => {
        fileInputRef.current?.click();
    };

    const handleCameraClick = () => {
        cameraInputRef.current?.click();
    };

    const processFile = (file: File): Promise<Attachment> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                const base64Data = event.target?.result as string;
                if (file.type.startsWith('image/')) {
                    const compressed = await compressImage(base64Data);
                    resolve({ name: file.name, mimeType: file.type, data: compressed });
                } else {
                    resolve({ name: file.name, mimeType: file.type, data: base64Data });
                }
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const compressImage = (base64Str: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = () => resolve(base64Str);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const processed = await Promise.all(newFiles.map(processFile));
            setAttachments(prev => [...prev, ...processed]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        if (!e.clipboardData || !e.clipboardData.items) return;
        const items = e.clipboardData.items;
        const newAttachments: Attachment[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const processed = await processFile(blob);
                    processed.name = `print_${Date.now()}.jpg`;
                    newAttachments.push(processed);
                }
            }
        }
        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() && attachments.length === 0 && isSearch === (cte.isSearch || false)) return;

        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const baseNote: Note = {
                id: Date.now().toString(),
                cteId: cte.id,
                date: new Date().toLocaleDateString('pt-BR'),
                author: currentUser,
                text: text,
                isSearchProcess: isSearch
            };

            const itemsToSend: Note[] = [];

            if (attachments.length === 0) {
                itemsToSend.push(baseNote);
            } else {
                itemsToSend.push({ ...baseNote, attachments: [attachments[0]] });
                for (let i = 1; i < attachments.length; i++) {
                    itemsToSend.push({
                        ...baseNote,
                        id: (Date.now() + i).toString(),
                        text: '',
                        attachments: [attachments[i]]
                    });
                }
            }

            for (let i = 0; i < itemsToSend.length; i++) {
                if (itemsToSend.length > 1) {
                    setLoadingStep(`Enviando ${i + 1} de ${itemsToSend.length}...`);
                }
                const res = await sendNoteToScript(itemsToSend[i], cte);
                if (!res.success) throw new Error(`Falha ao enviar item ${i + 1}: ${res.message}`);
                setHistory(prev => [...prev, itemsToSend[i]]);
            }

            setSuccessMsg('Salvo com sucesso!');
            setText('');
            setAttachments([]);
            setLoadingStep('');

            if (onNoteAdded) await onNoteAdded();
            setTimeout(() => onClose(), 1500);

        } catch (err: any) {
            console.error("Erro no processo de envio:", err);
            setErrorMsg(err.message || 'Erro de conexão. Verifique sua internet.');
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">CTE {cte.cteNumber}</h3>
                        <p className="text-sm text-gray-500">{cte.recipient}</p>
                    </div>
                    <button onClick={onClose} disabled={loading} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition disabled:opacity-50">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                    <div className="text-center text-xs text-gray-400 my-2">Histórico de Interações</div>
                    
                    {loadingHistory ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-500" /></div>
                    ) : history.length > 0 ? (
                        history.map((note, index) => (
                            <div key={note.id || index} className={`flex flex-col gap-1 ${note.author === currentUser ? 'items-end' : 'items-start'}`}>
                                <div className={`p-3 rounded-lg shadow-sm border max-w-[90%] break-words ${note.isSearchProcess ? 'bg-red-50 border-red-200' : note.author === currentUser ? 'bg-blue-50 border-blue-100 rounded-tr-none' : 'bg-white border-gray-100 rounded-tl-none'}`}>
                                    <div className="flex justify-between items-center gap-4 mb-1 border-b border-gray-200/50 pb-1">
                                        <div className="flex items-center gap-1">
                                            <User size={10} className="text-gray-400" />
                                            <span className="text-xs font-bold text-gray-700">{note.author}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400">{note.date}</span>
                                    </div>
                                    {note.isSearchProcess && (
                                        <div className="flex items-center gap-1 text-xs font-bold text-red-600 mb-2 bg-red-100 px-2 py-0.5 rounded w-fit">
                                            <AlertTriangle size={12} /> Mercadoria em Busca
                                        </div>
                                    )}
                                    
                                    {note.text && <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>}
                                    
                                    {(note.attachments || (note.imageUrl ? [{data: note.imageUrl, mimeType: 'image/jpeg', name: 'Anexo'}] : [])).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {(note.attachments || (note.imageUrl ? [{data: note.imageUrl, mimeType: 'image/jpeg', name: 'Anexo'}] : [])).map((att: any, idx: number) => (
                                                <a key={idx} href={att.data} target="_blank" rel="noopener noreferrer" className="block relative group border border-gray-200 rounded overflow-hidden hover:opacity-90 transition-all">
                                                    <AttachmentThumbnail att={att} />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                         <div className="text-center py-8">
                            <p className="text-gray-400 text-sm italic">Nenhuma interação registrada ainda.</p>
                            {cte.justification && (
                                <div className="mt-4 mx-auto max-w-[80%] bg-white p-3 rounded-lg border border-gray-200 text-left">
                                    <p className="text-xs text-gray-400 mb-1">Justificativa Original (CSV):</p>
                                    <p className="text-sm text-gray-600">{cte.justification}</p>
                                </div>
                            )}
                         </div>
                    )}
                    <div ref={historyEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-100 shrink-0">
                    
                    {errorMsg && (
                        <div className="mb-2 p-2 bg-red-50 text-red-600 text-xs rounded flex items-center gap-2">
                            <AlertCircle size={14} /> {errorMsg}
                        </div>
                    )}
                    
                    {successMsg && (
                        <div className="mb-2 p-2 bg-green-50 text-green-600 text-xs rounded flex items-center gap-2">
                            <Check size={14} /> {successMsg}
                        </div>
                    )}

                    <div className="mb-3">
                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSearch ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            <input 
                                type="checkbox" 
                                checked={isSearch} 
                                onChange={(e) => setIsSearch(e.target.checked)} 
                                className="w-4 h-4 text-red-600 rounded focus:ring-red-500" 
                                disabled={loading}
                            />
                            <div className="flex items-center gap-2 font-medium text-sm"><AlertTriangle size={16} /> Marcar como "Mercadoria em Busca"</div>
                        </label>
                    </div>
                    
                    {attachments.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            {attachments.map((att, index) => (
                                <div key={index} className="relative group w-16 h-16 bg-white rounded border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
                                    <AttachmentThumbnail att={att} />
                                    <button 
                                        type="button" 
                                        onClick={() => removeAttachment(index)} 
                                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow" 
                                        disabled={loading}
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="relative">
                        <textarea 
                            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-gray-800 placeholder-gray-400 transition-all disabled:opacity-60" 
                            rows={2} 
                            placeholder="Digite uma observação (Cole prints com Ctrl+V)..." 
                            value={text} 
                            onChange={(e) => setText(e.target.value)} 
                            onPaste={handlePaste}
                            disabled={loading}
                        ></textarea>
                        
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,audio/*,video/*" multiple className="hidden" />
                        <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
                        
                        <div className="absolute right-2 bottom-2 flex gap-1">
                            <button type="button" onClick={handleCameraClick} className={`p-2 transition rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-100`} title="Usar Câmera" disabled={loading}>
                                <Camera size={20} />
                            </button>
                            <button type="button" onClick={handleAttachmentClick} className={`p-2 transition rounded-lg ${attachments.length > 0 ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'}`} title="Anexar Arquivos" disabled={loading}>
                                <Paperclip size={20} />
                            </button>
                            <button type="submit" disabled={loading || (!text.trim() && attachments.length === 0 && !isSearch === !!cte.isSearch)} className={`p-2 rounded-lg transition shadow-md flex items-center justify-center min-w-[40px] ${successMsg ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                                {loading ? (
                                    <div className="flex items-center gap-1">
                                        <Loader2 size={18} className="animate-spin" />
                                        {loadingStep && <span className="text-[10px] hidden sm:inline whitespace-nowrap">{loadingStep}</span>}
                                    </div>
                                ) : successMsg ? <Check size={18} /> : <Send size={18} />}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NoteModal;