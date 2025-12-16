import { GoogleGenAI } from "@google/genai";
import { CTE } from "../types";

export const analyzeData = async (ctes: CTE[], context: string): Promise<string> => {
    // Tenta obter a chave de forma segura
    let apiKey = '';
    
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            // @ts-ignore
            apiKey = process.env.API_KEY;
        } else if (import.meta.env && import.meta.env.VITE_API_KEY) {
            apiKey = import.meta.env.VITE_API_KEY;
        }
    } catch (e) {
        console.warn("Erro ao ler variáveis de ambiente", e);
    }

    if (!apiKey) {
        console.error("Gemini API Key ausente.");
        return "Erro de Configuração: Chave de API da IA não detectada. Adicione VITE_API_KEY ou API_KEY nas variáveis de ambiente.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        // Limita o tamanho do payload para economizar tokens e evitar erros de tamanho
        const summary = ctes.slice(0, 30).map(c => 
            `CTE:${c.cteNumber}|St:${c.status}|Val:${c.value}|Unit:${c.deliveryUnit}`
        ).join('\n');

        const prompt = `
        Atue como Consultor Logístico.
        Contexto: ${context}
        
        Dados Resumidos:
        ${summary}
        
        Forneça uma análise curta e estratégica em Markdown (máx 3 tópicos):
        1. Gargalo Principal
        2. Ação Recomendada
        3. Previsão de Impacto
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        if (response && response.text) {
             return response.text;
        }
        
        return "A IA processou os dados mas não retornou texto legível.";

    } catch (error: any) {
        console.error("Gemini Service Error:", error);
        return `Serviço Indisponível: ${error.message || 'Erro desconhecido na IA'}.`;
    }
};