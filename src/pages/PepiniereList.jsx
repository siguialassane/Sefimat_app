import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sprout, RefreshCw, Eye } from "lucide-react";
import { useData } from "@/contexts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { isInSecretariatScope } from "@/lib/secretariat";

export function PepiniereList() {
    const navigate = useNavigate();
    const { inscriptions, loading, refresh } = useData();
    const [search, setSearch] = useState("");

    const pepinieres = useMemo(() => inscriptions
        .filter((row) => row.est_pepiniere === true && isInSecretariatScope(row))
        .filter((row) => `${row.nom || ""} ${row.prenom || ""} ${row.reference_id || ""}`
            .toLowerCase().includes(search.toLowerCase())), [inscriptions, search]);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-text-main dark:text-white flex items-center gap-2">
                        <Sprout className="h-7 w-7 text-emerald-600" /> Liste des pépinières
                    </h1>
                    <p className="mt-1 text-sm text-text-secondary">Participants enregistrés comme pépinières : {pepinieres.length}</p>
                </div>
                <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
                </Button>
            </header>

            <Card className="p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher nom ou référence..." className="pl-10" />
                </div>
            </Card>

            <Card className="overflow-hidden">
                {loading && !inscriptions.length ? (
                    <p className="p-8 text-center text-text-secondary">Chargement des pépinières...</p>
                ) : pepinieres.length === 0 ? (
                    <div className="p-10 text-center">
                        <Sprout className="h-10 w-10 mx-auto mb-3 text-text-secondary" />
                        <p className="font-medium text-text-main dark:text-white">Aucune pépinière trouvée</p>
                        <p className="text-sm text-text-secondary mt-1">Les participants marqués « Pépinière » apparaîtront ici.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                <tr>
                                    <th className="p-4">Participant</th><th className="p-4">Référence</th>
                                    <th className="p-4">Âge</th><th className="p-4">Sexe</th>
                                    <th className="p-4">Inscrit par</th><th className="p-4">Date</th><th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {pepinieres.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                        <td className="p-4"><div className="flex items-center gap-3 min-w-[180px]"><div className="h-10 w-10 rounded-full overflow-hidden shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">{row.photo_url ? <img src={row.photo_url} alt={`Photo de ${row.nom} ${row.prenom}`} className="w-full h-full object-cover" /> : <span className="text-text-secondary font-bold">{row.nom?.charAt(0) || "?"}</span>}</div><span className="font-semibold text-text-main dark:text-white">{row.nom} {row.prenom}</span></div></td>
                                        <td className="p-4 font-mono text-primary">{row.reference_id || "—"}</td>
                                        <td className="p-4">{row.age ? `${row.age} ans` : "—"}</td>
                                        <td className="p-4">{row.sexe || "—"}</td>
                                        <td className="p-4">{row.chef_quartier?.nom_complet || "Secrétariat"}</td>
                                        <td className="p-4">{row.created_at ? new Date(row.created_at).toLocaleDateString("fr-FR") : "—"}</td>
                                        <td className="p-4"><Button variant="outline" size="sm" className="gap-1" onClick={() => navigate("/admin/inscriptions", { state: { detailId: row.id } })}><Eye className="h-4 w-4" /> Détail</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
