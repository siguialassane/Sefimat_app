import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Users,
    CheckCircle,
    Clock,
    TrendingUp,
    Download,
    Search,
    Filter,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from "recharts";

// Mock data for charts
const activityData = [
    { day: "J1", inscriptions: 12 },
    { day: "J5", inscriptions: 25 },
    { day: "J10", inscriptions: 18 },
    { day: "J15", inscriptions: 45 },
    { day: "J20", inscriptions: 32 },
    { day: "J25", inscriptions: 58 },
    { day: "J30", inscriptions: 72 },
];

// Mock data for leaders
const leadersData = [
    {
        id: 1,
        name: "Amadou Koné",
        zone: "Abobo - Zone 1",
        total: 142,
        validated: 120,
        pending: 22,
        progress: 85,
        avatar: "AK",
    },
    {
        id: 2,
        name: "Moussa Diaby",
        zone: "Cocody - Riviera",
        total: 98,
        validated: 45,
        pending: 53,
        progress: 45,
        avatar: "MD",
    },
    {
        id: 3,
        name: "Fatima Touré",
        zone: "Yopougon - Sideci",
        total: 210,
        validated: 200,
        pending: 10,
        progress: 95,
        avatar: "FT",
    },
    {
        id: 4,
        name: "Ibrahim Coulibaly",
        zone: "Marcory - Zone 4",
        total: 76,
        validated: 70,
        pending: 6,
        progress: 92,
        avatar: "IC",
    },
];

const stats = [
    {
        title: "Total Inscriptions",
        value: "1,240",
        change: "+12%",
        changeType: "positive",
        icon: Users,
        iconBg: "bg-blue-50 dark:bg-blue-900/20",
        iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
        title: "Validées",
        value: "850",
        change: "+5%",
        changeType: "positive",
        icon: CheckCircle,
        iconBg: "bg-green-50 dark:bg-green-900/20",
        iconColor: "text-green-600 dark:text-green-400",
    },
    {
        title: "En attente",
        value: "390",
        change: "-2%",
        changeType: "negative",
        icon: Clock,
        iconBg: "bg-amber-50 dark:bg-amber-900/20",
        iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
        title: "Frais collectés (FCFA)",
        value: "2.48M",
        change: "+10%",
        changeType: "positive",
        icon: TrendingUp,
        iconBg: "bg-purple-50 dark:bg-purple-900/20",
        iconColor: "text-purple-600 dark:text-purple-400",
    },
];

export function Dashboard() {
    const [searchTerm, setSearchTerm] = useState("");
    const [timeRange, setTimeRange] = useState("30");

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-main dark:text-white">
                        Tableau de bord
                    </h1>
                    <p className="text-text-secondary dark:text-gray-400 text-sm md:text-base">
                        Bienvenue, Administrateur. Voici les dernières statistiques.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="hidden md:block text-sm text-text-secondary dark:text-gray-400 bg-white dark:bg-white/5 px-3 py-2 rounded-lg border border-border-light dark:border-border-dark">
                        Dernière mise à jour : Aujourd'hui, 10:45
                    </span>
                    <Button className="gap-2">
                        <Download className="h-4 w-4" />
                        Exporter
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <Card
                        key={index}
                        className="p-5 flex flex-col justify-between gap-4 hover:border-primary/50 transition-colors group"
                    >
                        <div className="flex justify-between items-start">
                            <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                            </div>
                            <Badge
                                variant={stat.changeType === "positive" ? "success" : "destructive"}
                                className="text-xs"
                            >
                                {stat.change}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-text-secondary dark:text-gray-400 text-sm font-medium">
                                {stat.title}
                            </p>
                            <p className="text-2xl font-bold text-text-main dark:text-white mt-1">
                                {stat.value}
                            </p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1: Registrations Activity */}
                <Card className="lg:col-span-2 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <CardTitle>Activité des inscriptions</CardTitle>
                            <CardDescription>Inscriptions journalières sur les 30 derniers jours</CardDescription>
                        </div>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="bg-gray-50 dark:bg-white/5 border-none text-sm text-text-secondary dark:text-gray-300 rounded-lg py-1 px-3 focus:ring-1 focus:ring-primary outline-none"
                        >
                            <option value="30">30 derniers jours</option>
                            <option value="7">7 derniers jours</option>
                        </select>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityData}>
                                <defs>
                                    <linearGradient id="colorInscriptions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#13ec5b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#13ec5b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="inscriptions"
                                    stroke="#13ec5b"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorInscriptions)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Chart 2: Demographics */}
                <Card className="p-6 flex flex-col gap-6">
                    <div>
                        <CardTitle>Démographiques</CardTitle>
                        <CardDescription>Répartition par genre et niveau d'étude</CardDescription>
                    </div>

                    {/* Gender Distribution */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-text-main dark:text-gray-300">Ratio par genre</span>
                            <span className="text-text-secondary text-xs">Total: 1,240</span>
                        </div>
                        <div className="flex h-4 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
                            <div className="bg-blue-500 h-full" style={{ width: "58%" }} />
                            <div className="bg-pink-400 h-full" style={{ width: "42%" }} />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-text-secondary dark:text-gray-400">Hommes (58%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-pink-400" />
                                <span className="text-text-secondary dark:text-gray-400">Femmes (42%)</span>
                            </div>
                        </div>
                    </div>

                    {/* Education Distribution */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                        <span className="font-medium text-sm text-text-main dark:text-gray-300 mb-1">
                            Niveau d'étude
                        </span>
                        {[
                            { label: "Primaire", value: 30 },
                            { label: "Secondaire", value: 45 },
                            { label: "Universitaire", value: 25 },
                        ].map((item) => (
                            <div key={item.label} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center">
                                <span className="text-xs font-medium text-text-secondary w-20">{item.label}</span>
                                <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full"
                                        style={{ width: `${item.value}%` }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-text-main dark:text-white">
                                    {item.value}%
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Neighborhood Leaders Table */}
            <Card className="overflow-hidden">
                <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Performance des chefs de quartier</CardTitle>
                        <CardDescription>Détails des inscriptions par zone</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                            <Input
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 w-full sm:w-64"
                            />
                        </div>
                        <Button variant="outline" size="icon" className="h-10 w-10">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-white/5 text-text-secondary dark:text-gray-400 font-semibold uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Chef de quartier</th>
                                <th className="px-6 py-4">Zone</th>
                                <th className="px-6 py-4 text-center">Total</th>
                                <th className="px-6 py-4 text-center">Validées</th>
                                <th className="px-6 py-4 text-center">En attente</th>
                                <th className="px-6 py-4 text-center">Progression</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                            {leadersData.map((leader) => (
                                <tr
                                    key={leader.id}
                                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                                {leader.avatar}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-text-main dark:text-white">
                                                    {leader.name}
                                                </span>
                                                <span className="text-xs text-text-secondary">ID: #LDR-00{leader.id}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-text-secondary dark:text-gray-300">{leader.zone}</td>
                                    <td className="px-6 py-4 text-center font-bold text-text-main dark:text-white">
                                        {leader.total}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Badge variant="success">{leader.validated}</Badge>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Badge variant="warning">{leader.pending}</Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="w-24 mx-auto h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${leader.progress >= 80 ? "bg-primary" : "bg-amber-500"
                                                    }`}
                                                style={{ width: `${leader.progress}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-text-secondary hover:text-primary transition-colors">
                                            <MoreVertical className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-border-light dark:border-border-dark flex items-center justify-between">
                    <p className="text-sm text-text-secondary dark:text-gray-400">
                        Affichage de <span className="font-medium text-text-main dark:text-white">1</span> à{" "}
                        <span className="font-medium text-text-main dark:text-white">4</span> sur{" "}
                        <span className="font-medium text-text-main dark:text-white">24</span> résultats
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Précédent
                        </Button>
                        <Button variant="outline" size="sm">
                            Suivant
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
