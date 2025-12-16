import { GoogleGenAI } from "@google/genai";
import { CTE } from "../types";

// Helper seguro para obter variáveis de ambiente
const getApiKey = (): string | undefined => {
    // Acesso via Vite (Tipado via vite-env.d.ts)
    if (import.meta.env && import.meta.env.VITE_API_KEY) {
        return import.meta.env.VITE_API_KEY;
    }
    return undefined;
};

export const analyzeData = async (ctes: CTE[], context: string): Promise<string> => {
    const apiKey = getApiKey();

    if (!apiKey) {
        console.warn("Gemini API Key missing");
        return "Erro de Configuração: Chave de API da IA não detectada no ambiente. Adicione VITE_API_KEY nas variáveis de ambiente do Vercel.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const summary = ctes.slice(0, 40).map(c => 
            `${c.cteNumber}|${c.status}|${c.value}|${c.deliveryUnit}`
        ).join('\n');

        const prompt = `
        Atue como um Consultor de Logística Sênior especializado em eficiência operacional.
        Utilize a Lei de Pareto (80/20) para analisar os dados abaixo e o contexto fornecido.
        
        Contexto: ${context}
        
        Dados (Amostra Compacta - CTE|Status|Valor|Destino):
        ${summary}
        
        Gere uma análise direta, técnica e acionável em Markdown (sem introduções longas):
        1. **Diagnóstico (Onde atacar?)**: Identifique a unidade ou padrão que representa o maior gargalo (os 20% dos problemas).
        2. **Ação Imediata**: Uma recomendação prática para resolver esse ofensor hoje.
        3. **Impacto Estimado**: O que a empresa ganha resolvendo isso.
        
        Seja conciso.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "A análise foi concluída, mas o provedor de IA não retornou texto.";

    } catch (error: any) {
        console.error("Gemini Service Error:", error);

        const errorMessage = error.toString();
        
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            return "⛔ Conexão Recusada: O navegador bloqueou o acesso à IA. \n\nPossíveis causas:\n1. Bloqueador de anúncios (AdBlock) ativo.\n2. Firewall de rede corporativa.\n\nTente desativar o AdBlock para este site.";
        }
        
        if (errorMessage.includes('403') || errorMessage.includes('key')) {
             return "⛔ Erro de Autenticação: A chave de API configurada é inválida ou expirou.";
        }

        if (errorMessage.includes('429')) {
             return "⏳ Sistema Ocupado: Limite de uso da IA atingido. Aguarde um momento e tente novamente.";
        }

        return "O serviço de Inteligência Artificial está temporariamente indisponível. Tente novamente em alguns instantes.";
    }
};
