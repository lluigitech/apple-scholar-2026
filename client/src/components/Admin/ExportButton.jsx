import React from 'react';
import axios from 'axios';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const ExportButton = ({ dataToExport, filename = "Kalinga_Foundation_Data" }) => {
    
    const triggerExcelDownload = () => {
        if(!dataToExport || dataToExport.length === 0) {
            alert("No data available to export.");
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Report");
        XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);

        axios.post(`${API}/export/google-sheets`, {
          log_only: true,
          module: 'Audit Log',
          report_resource: 'Audit Log',
          spreadsheet_title: filename,
          details: `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`,
        }, getAuthHeaders()).catch(() => {});
    };

    return (
        <button 
            onClick={triggerExcelDownload}
            className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-sans font-bold text-xs px-5 py-3 rounded-xl uppercase tracking-wider shadow-sm transition-colors"
        >
            <FileSpreadsheet size={14} /> Export Sheet
        </button>
    );
};

export default ExportButton;