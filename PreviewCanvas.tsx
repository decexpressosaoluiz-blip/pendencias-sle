import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, AlertTriangle } from 'lucide-react';

const mockBarData = [
  { name: 'São Paulo', value: 4000 },
  { name: 'Rio de Janeiro', value: 3000 },
  { name: 'Belo Horizonte', value: 2000 },
  { name: 'Curitiba', value: 2780 },
  { name: 'Salvador', value: 1890 },
];

const mockPieData = [
  { name: 'No Prazo', value: 400 },
  { name: 'Atrasado', value: 300 },
  { name: 'Crítico', value: 300 },
  { name: 'Em Busca', value: 200 },
];

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export const PreviewCanvas = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Package /></div>
          <div><p className="text-sm text-gray-500">Total Pendente</p><h3 className="text-2xl font-bold">1,250</h3></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center text-red-600"><AlertTriangle /></div>
          <div><p className="text-sm text-gray-500">Críticos</p><h3 className="text-2xl font-bold">45</h3></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600"><TrendingUp /></div>
          <div><p className="text-sm text-gray-500">Eficiência</p><h3 className="text-2xl font-bold">94%</h3></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Volume por Unidade</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockBarData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Status das Entregas</h3>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mockPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {mockPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};