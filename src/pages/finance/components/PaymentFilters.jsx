import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

export function PaymentFilters({
    searchTerm,
    onSearchChange,
    filterChef,
    onChefChange,
    chefsQuartier = [],
    showStatusFilter = false,
    filterStatus,
    onStatusChange,
}) {
    return (
        <Card className="p-4">
            <div className={`grid grid-cols-1 ${showStatusFilter ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
                <div>
                    <Label className="mb-1.5 block text-xs">Recherche</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                        <Input
                            placeholder="Nom, prénom ou référence..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                
                {showStatusFilter && (
                    <div>
                        <Label className="mb-1.5 block text-xs">Statut</Label>
                        <Select
                            value={filterStatus}
                            onChange={(e) => onStatusChange(e.target.value)}
                        >
                            <option value="tous">📋 Tous les paiements</option>
                            <option value="solde">💰 Soldés</option>
                            <option value="valide_financier">✅ Validé par admin</option>
                        </Select>
                    </div>
                )}
                
                <div>
                    <Label className="mb-1.5 block text-xs">Président de section</Label>
                    <Select
                        value={filterChef}
                        onChange={(e) => onChefChange(e.target.value)}
                    >
                        <option value="">Tous</option>
                        <option value="presentiel">🏢 Présentiel uniquement</option>
                        {chefsQuartier.map((chef) => (
                            <option key={chef.id} value={chef.id}>
                                {chef.nom_complet}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>
        </Card>
    );
}
