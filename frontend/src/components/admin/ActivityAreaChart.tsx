import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

export type ActivityPoint = { name: string; active: number };

/**
 * The activity chart, split out of AdminDashboard so recharts can be lazily
 * loaded.
 *
 * recharts is ~330KB and was the sole reason the AdminDashboard route chunk was
 * 328KB — the chart sits below the stat cards, so the whole page was blocked on
 * a library needed for one element. This module is the only importer of
 * recharts in the codebase; keeping it that way is what preserves the split.
 */
const ActivityAreaChart = ({ data }: { data: ActivityPoint[] }) => (
    <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
            <defs>
                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="active" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
        </AreaChart>
    </ResponsiveContainer>
);

export default ActivityAreaChart;
