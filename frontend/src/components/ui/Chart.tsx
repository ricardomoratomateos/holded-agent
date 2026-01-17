import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title?: string;
  data: Array<{ name: string; value: number }>;
}

const COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];

export const Chart = ({ type, title, data }: ChartData) => {
  return (
    <div className="my-4 p-4 bg-white/5 rounded-xl border border-white/10">
      {title && <h4 className="text-sm font-medium text-[#eee] mb-3">{title}</h4>}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fill: '#b4b4b4', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
              <YAxis tick={{ fill: '#b4b4b4', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#303030', border: '1px solid #444', borderRadius: '8px' }}
                labelStyle={{ color: '#eee' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data}>
              <XAxis dataKey="name" tick={{ fill: '#b4b4b4', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
              <YAxis tick={{ fill: '#b4b4b4', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#303030', border: '1px solid #444', borderRadius: '8px' }}
                labelStyle={{ color: '#eee' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#666' }}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#303030', border: '1px solid #444', borderRadius: '8px' }}
                labelStyle={{ color: '#eee' }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Parser para detectar bloques de chart en el texto
export const parseChartBlocks = (text: string): Array<{ type: 'text' | 'chart' | 'loading'; content: string | ChartData }> => {
  const parts: Array<{ type: 'text' | 'chart' | 'loading'; content: string | ChartData }> = [];

  // Primero: detectar si hay un chart incompleto (streaming)
  const lastChartStart = text.lastIndexOf('```chart');
  let hasIncompleteChart = false;
  let cleanText = text;

  if (lastChartStart !== -1) {
    const afterChartStart = text.slice(lastChartStart);
    // Buscar cierre después del inicio del chart
    const closingMatch = afterChartStart.match(/\n```(?:\s|$)/);
    if (!closingMatch) {
      // Chart incompleto - cortar el texto ahí
      hasIncompleteChart = true;
      cleanText = text.slice(0, lastChartStart);
    }
  }

  // Parsear charts completos
  const chartRegex = /```chart\n([\s\S]*?)\n```/g;
  let lastIndex = 0;
  let match;

  while ((match = chartRegex.exec(cleanText)) !== null) {
    // Add text before the chart
    if (match.index > lastIndex) {
      const textBefore = cleanText.slice(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore });
      }
    }

    // Parse and add the chart
    try {
      const chartData = JSON.parse(match[1]) as ChartData;
      parts.push({ type: 'chart', content: chartData });
    } catch (e) {
      // If JSON parsing fails, skip it
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < cleanText.length) {
    const remainingText = cleanText.slice(lastIndex).trim();
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }
  }

  // Añadir loading si hay chart incompleto
  if (hasIncompleteChart) {
    parts.push({ type: 'loading', content: 'Generando gráfico...' });
  }

  // If no parts found, return original text
  if (parts.length === 0 && text.trim() && !hasIncompleteChart) {
    parts.push({ type: 'text', content: text });
  }

  return parts;
};
