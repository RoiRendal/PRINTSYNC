import React from 'react';
import { Printer, Download, ReceiptText } from 'lucide-react';
import { FinancialRecord, FinancialStats } from '../../../shared/types/domain';

interface FinancialReportProps {
  records: FinancialRecord[];
  stats: FinancialStats;
  businessName: string;
}

export const FinancialReport: React.FC<FinancialReportProps> = ({ records, stats, businessName }) => {
  const currentDate = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white p-16 text-black font-sans max-w-full mx-auto border border-gray-200 shadow-2xl print:shadow-none print:border-none print:p-0 rounded-lg" id="professional-report">
      {/* Report Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold uppercase tracking-tighter leading-none">{businessName}</h1>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500 mt-2 font-medium">Financial Performance Statement</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono font-bold uppercase bg-black text-white px-2 py-1 inline-block">Report ID: RPT-{Math.floor(Math.random() * 100000)}</p>
          <p className="text-xs font-mono text-gray-500 uppercase mt-2 font-semibold">Generated: {currentDate}</p>
        </div>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
        <div className="border-l-[6px] border-black pl-6 py-2">
          <p className="text-xs uppercase font-bold text-gray-500 tracking-[0.1em] mb-1">Gross Revenue</p>
          <p className="text-3xl font-mono font-bold">₱{stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="border-l-[6px] border-red-600 pl-6 py-2">
          <p className="text-xs uppercase font-bold text-gray-500 tracking-[0.1em] mb-1">Operating Expenses</p>
          <p className="text-3xl font-mono font-bold text-red-600">₱{stats.totalExpenses.toLocaleString()}</p>
        </div>
        <div className="border-l-[6px] border-green-600 pl-6 py-2">
          <p className="text-xs uppercase font-bold text-gray-500 tracking-[0.1em] mb-1">Net Profit</p>
          <p className="text-3xl font-mono font-bold text-green-600">₱{stats.netProfit.toLocaleString()}</p>
        </div>
      </div>

      {/* Narrative Section */}
      <div className="mb-12 p-8 bg-gray-50 border border-gray-200 rounded-sm">
        <h3 className="text-sm font-bold uppercase mb-4 flex items-center gap-3">
          <ReceiptText className="w-4 h-4 text-gray-900" />
          <span className="tracking-widest">Executive Summary</span>
        </h3>
        <p className="text-sm leading-relaxed text-gray-700 max-w-3xl">
          For the current reporting period, <span className="font-bold text-black">{businessName}</span> achieved a total revenue of <span className="font-mono font-bold">₱{stats.totalRevenue.toLocaleString()}</span>. 
          With operating expenses totaling <span className="font-mono font-bold text-red-600">₱{stats.totalExpenses.toLocaleString()}</span>, the enterprise maintains a healthy net profit 
          of <span className="font-mono font-bold text-green-600">₱{stats.netProfit.toLocaleString()}</span>, resulting in a profit margin of <span className="font-bold">{stats.profitMargin.toFixed(1)}%</span>. 
          The primary growth drivers are Screen Printing and DTF Printing services.
        </p>
      </div>

      {/* Detailed Ledger Table */}
      <div className="mb-12">
        <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-2">
          <h3 className="text-sm font-bold uppercase tracking-widest">Fiscal Transaction Ledger</h3>
          <p className="text-[10px] text-gray-400 uppercase font-mono">Verified Transactions</p>
        </div>
        <div className="overflow-hidden border border-gray-100 rounded-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 uppercase font-bold tracking-tight text-gray-600 text-xs">
                <th className="text-left p-4 border-b border-gray-200">Date</th>
                <th className="text-left p-4 border-b border-gray-200">Category</th>
                <th className="text-left p-4 border-b border-gray-200">Description</th>
                <th className="text-right p-4 border-b border-gray-200">Amount</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono text-gray-500 whitespace-nowrap">{record.date}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase text-gray-600">
                      {record.category}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 italic leading-snug">{record.description}</td>
                  <td className={`p-4 text-right font-mono font-bold ${record.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {record.type === 'Income' ? '+' : '-'}₱{record.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-50">
                <td colSpan={3} className="p-4 text-right text-xs uppercase tracking-widest text-gray-500">Balance Forward</td>
                <td className="p-4 text-right text-lg font-mono border-l border-gray-100">₱{stats.netProfit.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-20 pt-10 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center md:items-end gap-8">
        <div className="space-y-6 flex-1 md:flex-none">
          <div className="w-64 border-b-2 border-black h-12"></div>
          <div>
            <p className="text-xs uppercase font-bold tracking-[0.2em] text-gray-900">Authorized Signature</p>
            <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-wider">Finance Department - Internal Audit Copy</p>
          </div>
        </div>
        <div className="flex gap-3 print:hidden shrink-0">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-md hover:bg-gray-800 transition-all active:scale-95 shadow-md"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button className="flex items-center gap-2 px-6 py-3 border-2 border-black text-black text-xs font-bold uppercase tracking-widest rounded-md hover:bg-gray-50 transition-all active:scale-95">
            <Download className="w-4 h-4" />
            Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
};

