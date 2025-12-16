import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = "Dados") => {
    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        // Formatar largura das colunas (auto-fit aproximado)
        const colWidths = Object.keys(data[0] || {}).map(key => ({
            wch: Math.max(key.length, 15)
        }));
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `${fileName}.xlsx`);
        return true;
    } catch (error) {
        console.error("Erro ao exportar Excel:", error);
        return false;
    }
};