import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Users,
    CheckCircle,
    Clock,
    Download,
    Search,
    Filter,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    Building,
    BookOpen,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts";

export function Dashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [leadersData, setLeadersData] = useState([]);
    const [demographics, setDemographics] = useState(null);
    const [dortoirStats, setDortoirStats] = useState([]);
    const [niveauFormationStats, setNiveauFormationStats] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Charger les statistiques globales
    useEffect(() => {
        async function loadStats() {
            try {
                setLoading(true);

                // Compter toutes les inscriptions par statut
                const { data: inscriptions, error } = await supabase
                    .from('inscriptions')
                    .select('statut, sexe, niveau_etude');

                if (error) throw error;

                const total = inscriptions.length;
                const valide = inscriptions.filter(i => i.statut === 'valide').length;
                const en_attente = inscriptions.filter(i => i.statut === 'en_attente').length;
                const rejete = inscriptions.filter(i => i.statut === 'rejete').length;

                // Calculer démographiques
                const hommes = inscriptions.filter(i => i.sexe === 'homme').length;
                const femmes = inscriptions.filter(i => i.sexe === 'femme').length;

                const niveauCounts = inscriptions.reduce((acc, i) => {
                    acc[i.niveau_etude] = (acc[i.niveau_etude] || 0) + 1;
                    return acc;
                }, {});

                setStats([
                    {
                        title: "Total Inscriptions",
                        value: total.toString(),
                        icon: Users,
                        iconBg: "bg-blue-50 dark:bg-blue-900/20",
                        iconColor: "text-blue-600 dark:text-blue-400",
                    },
                    {
                        title: "Validées",
                        value: valide.toString(),
                        icon: CheckCircle,
                        iconBg: "bg-green-50 dark:bg-green-900/20",
                        iconColor: "text-green-600 dark:text-green-400",
                    },
                    {
                        title: "En attente",
                        value: en_attente.toString(),
                        icon: Clock,
                        iconBg: "bg-amber-50 dark:bg-amber-900/20",
                        iconColor: "text-amber-600 dark:text-amber-400",
                    },
                ]);

                setDemographics({
                    hommesPercent: total > 0 ? Math.round((hommes / total) * 100) : 0,
                    femmesPercent: total > 0 ? Math.round((femmes / total) * 100) : 0,
                    total,
                    niveauPercent: {
                        primaire: total > 0 ? Math.round(((niveauCounts.primaire || 0) / total) * 100) : 0,
                        secondaire: total > 0 ? Math.round(((niveauCounts.secondaire || 0) / total) * 100) : 0,
                        superieur: total > 0 ? Math.round(((niveauCounts.superieur || 0) / total) * 100) : 0,
                    }
                });

            } catch (error) {
                console.error('Erreur chargement stats:', error);
            } finally {
                setLoading(false);
            }
        }

        loadStats();
    }, []);

    // Charger la performance des chefs de quartier
    useEffect(() => {
        async function loadLeadersData() {
            try {
                const { data: chefs, error } = await supabase
                    .from('chefs_quartier')
                    .select(`
                        id,
                        nom_complet,
                        zone,
                        inscriptions:inscriptions(statut)
                    `);

                if (error) throw error;

                const formattedLeaders = chefs.map(chef => {
                    const total = chef.inscriptions.length;
                    const validated = chef.inscriptions.filter(i => i.statut === 'valide').length;
                    const pending = chef.inscriptions.filter(i => i.statut === 'en_attente').length;
                    const progress = total > 0 ? Math.round((validated / total) * 100) : 0;

                    return {
                        id: chef.id,
                        name: chef.nom_complet,
                        zone: chef.zone,
                        total,
                        validated,
                        pending,
                        progress,
                        avatar: chef.nom_complet.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                    };
                }).sort((a, b) => b.total - a.total); // Trier par total décroissant

                setLeadersData(formattedLeaders);
            } catch (error) {
                console.error('Erreur chargement leaders:', error);
            }
        }

        loadLeadersData();
    }, []);

    // Charger les statistiques des dortoirs
    useEffect(() => {
        async function loadDortoirStats() {
            try {
                const { data, error } = await supabase
                    .from('vue_statistiques_dortoirs')
                    .select('*')
                    .order('nom');

                if (error) throw error;
                setDortoirStats(data || []);
            } catch (error) {
                console.error('Erreur chargement stats dortoirs:', error);
            }
        }

        loadDortoirStats();
    }, []);

    // Charger les statistiques des niveaux de formation
    useEffect(() => {
        async function loadNiveauFormationStats() {
            try {
                const { data, error } = await supabase
                    .from('vue_statistiques_niveaux_formation')
                    .select('*');

                if (error) throw error;
                setNiveauFormationStats(data || []);
            } catch (error) {
                console.error('Erreur chargement stats niveaux:', error);
            }
        }

        loadNiveauFormationStats();
    }, []);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <Card key={index} className="p-5 flex flex-col gap-4 animate-pulse">
                            <div className="flex justify-between items-start">
                                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                            </div>
                            <div>
                                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                            </div>
                        </Card>
                    ))
                ) : stats ? (
                    stats.map((stat, index) => (
                        <Card
                            key={index}
                            className="p-5 flex flex-col justify-between gap-4 hover:border-primary/50 transition-colors group"
                        >
                            <div className="flex justify-between items-start">
                                <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                                </div>
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
                    ))
                ) : (
                    <div className="col-span-full text-center py-8 text-text-secondary">
                        Aucune donnée disponible
                    </div>
                )}
            </div>

            {/* Demographics Section */}
            <Card className="p-6 flex flex-col gap-6">
                <div>
                    <CardTitle>Démographiques</CardTitle>
                    <CardDescription>Répartition par genre et niveau d'étude</CardDescription>
                </div>

                {loading || !demographics ? (
                    <div className="flex flex-col gap-4 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    </div>
                ) : (
                    <>
                        {/* Gender Distribution */}
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-text-main dark:text-gray-300">Ratio par genre</span>
                                <span className="text-text-secondary text-xs">Total: {demographics.total}</span>
                            </div>
                            <div className="flex h-4 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
                                <div className="bg-blue-500 h-full" style={{ width: `${demographics.hommesPercent}%` }} />
                                <div className="bg-pink-400 h-full" style={{ width: `${demographics.femmesPercent}%` }} />
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-text-secondary dark:text-gray-400">
                                        Hommes ({demographics.hommesPercent}%)
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-pink-400" />
                                    <span className="text-text-secondary dark:text-gray-400">
                                        Femmes ({demographics.femmesPercent}%)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Education Distribution */}
                        <div className="flex flex-col gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                            <span className="font-medium text-sm text-text-main dark:text-gray-300 mb-1">
                                Niveau d'étude
                            </span>
                            {[
                                { label: "Primaire", value: demographics.niveauPercent.primaire },
                                { label: "Secondaire", value: demographics.niveauPercent.secondaire },
                                { label: "Universitaire", value: demographics.niveauPercent.superieur },
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
                    </>
                )}
            </Card>

            {/* Statistiques Dortoirs et Niveaux de Formation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Occupation des Dortoirs */}
                <Card className="p-6 flex flex-col gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Building className="w-5 h-5 text-primary" />
                            <CardTitle>Occupation des Dortoirs</CardTitle>
                        </div>
                        <CardDescription>Répartition des participants par salle</CardDescription>
                    </div>

                    {loading ? (
                        <div className="flex flex-col gap-4 animate-pulse">
                            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                    ) : dortoirStats.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                            {dortoirStats.map(stat => {
                                const tauxNum = parseFloat(stat.taux_remplissage);
                                return (
                                    <div key={stat.id} className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-border-light dark:border-border-dark">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold text-text-main dark:text-white">{stat.nom}</span>
                                            <Badge variant={tauxNum >= 90 ? "destructive" : tauxNum >= 70 ? "warning" : "success"}>
                                                {stat.taux_remplissage}%
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-text-secondary dark:text-gray-400 mb-2">
                                            <span>{stat.nombre_inscrits} / {stat.capacite} places</span>
                                            <span className="font-medium">{stat.places_disponibles} disponibles</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    tauxNum >= 90 ? 'bg-red-500' :
                                                    tauxNum >= 70 ? 'bg-orange-500' :
                                                    'bg-emerald-500'
                                                }`}
                                                style={{ width: `${Math.min(tauxNum, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-text-secondary py-8">Aucune donnée disponible</p>
                    )}
                </Card>

                {/* Niveaux de Formation */}
                <Card className="p-6 flex flex-col gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-5 h-5 text-primary" />
                            <CardTitle>Niveaux de Formation</CardTitle>
                        </div>
                        <CardDescription>Répartition par niveau de connaissance</CardDescription>
                    </div>

                    {loading ? (
                        <div className="flex flex-col gap-4 animate-pulse">
                            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                    ) : niveauFormationStats.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {niveauFormationStats.map(stat => {
                                const niveauLabels = {
                                    debutant: "Débutant",
                                    normal: "Normal",
                                    superieur: "Supérieur"
                                };
                                const niveauColors = {
                                    debutant: "bg-blue-500",
                                    normal: "bg-purple-500",
                                    superieur: "bg-amber-500"
                                };

                                return (
                                    <div key={stat.niveau_formation} className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-text-main dark:text-white">
                                                {niveauLabels[stat.niveau_formation]}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-primary">{stat.nombre_inscrits}</span>
                                                <span className="text-xs text-text-secondary">({stat.pourcentage}%)</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${niveauColors[stat.niveau_formation]}`}
                                                style={{ width: `${stat.pourcentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Total */}
                            <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-text-main dark:text-white">Total Affectés</span>
                                    <span className="text-2xl font-bold text-primary">
                                        {niveauFormationStats.reduce((acc, curr) => acc + curr.nombre_inscrits, 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-text-secondary py-8">Aucune donnée disponible</p>
                    )}
                </Card>
            </div>

            {/* Neighborhood Leaders Table */}
            <Card className="overflow-hidden">
                <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Performance des présidents de section</CardTitle>
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
                                <th className="px-6 py-4">Président de section</th>
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
