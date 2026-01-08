import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Search,
    CheckCircle,
    XCircle,
    Eye,
    AlertCircle,
    DollarSign,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts";

export function PaymentValidation() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inscriptions, setInscriptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedInscription, setSelectedInscription] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Protection contre les doubles appels
    const hasLoaded = useRef(false);

    const loadPendingValidations = useCallback(async (forceRefresh = false) => {
        // Éviter les doubles appels sauf si refresh forcé
        if (!forceRefresh && hasLoaded.current) return;
        hasLoaded.current = true;
        
        setLoading(true);
        setError(null);
        try {
            console.log('PaymentValidation: Chargement des validations...');
            const { data, error: fetchError } = await supabase
                .from("inscriptions")
                .select(`
                    *,
                    chef_quartier:chefs_quartier(nom_complet, zone)
                `)
                .or("statut_paiement.eq.partiel,statut_paiement.eq.non_payé")
                .lt("montant_total_paye", 4000)
                .order("created_at", { ascending: false });

            if (fetchError) {
                console.error('PaymentValidation: Erreur Supabase:', fetchError);
                throw fetchError;
            }

            console.log('PaymentValidation: Données reçues:', data?.length || 0, 'inscriptions en attente');
            setInscriptions(data || []);
        } catch (err) {
            console.error("PaymentValidation: Exception chargement:", err);
            setError(err.message || "Erreur lors du chargement");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPendingValidations();
    }, [loadPendingValidations]);

    // Fonction de rafraîchissement pour le bouton
    const handleRefresh = () => loadPendingValidations(true);

    const handleValidate = async (inscriptionId) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("inscriptions")
                .update({
                    statut_paiement: "valide_financier",
                    valide_par_financier: user.id,
                    date_validation_financier: new Date().toISOString(),
                })
                .eq("id", inscriptionId);

            if (error) throw error;

            // Retirer de la liste
            setInscriptions(inscriptions.filter((i) => i.id !== inscriptionId));
            setModalOpen(false);
            setSelectedInscription(null);
        } catch (error) {
            console.error("Erreur validation:", error);
            alert("Erreur lors de la validation");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (inscriptionId) => {
        if (!confirm("Êtes-vous sûr de vouloir refuser ce paiement ?")) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("inscriptions")
                .update({
                    statut_paiement: "refuse",
                    valide_par_financier: user.id,
                    date_validation_financier: new Date().toISOString(),
                })
                .eq("id", inscriptionId);

            if (error) throw error;

            setInscriptions(inscriptions.filter((i) => i.id !== inscriptionId));
            setModalOpen(false);
            setSelectedInscription(null);
        } catch (error) {
            console.error("Erreur refus:", error);
            alert("Erreur lors du refus");
        } finally {
            setActionLoading(false);
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const filteredInscriptions = inscriptions.filter((i) =>
        `${i.nom} ${i.prenom}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Validations de Paiements
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Paiements inférieurs à 4.000 FCFA en attente de votre validation
                    </p>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2 border-emerald-500 text-emerald-600">
                    {inscriptions.length} en attente
                </Badge>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Search */}
                    <Card className="p-4">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                            <Input
                                placeholder="Rechercher par nom..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </Card>

                    {/* Table */}
                    <Card className="overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-text-secondary">Chargement des validations...</p>
                            </div>
                        ) : filteredInscriptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
                                <p className="text-text-main dark:text-white text-lg font-medium">
                                    Toutes les validations sont à jour
                                </p>
                                <p className="text-text-secondary">
                                    Aucun paiement n'est en attente de validation.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                        <tr>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                Participant
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                Référence
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                Président de section
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                                Montant payé
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                                Reste
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {filteredInscriptions.map((inscription) => (
                                            <tr
                                                key={inscription.id}
                                                className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                                            {inscription.photo_url ? (
                                                                <img
                                                                    src={inscription.photo_url}
                                                                    alt={inscription.nom}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="text-lg text-gray-400">
                                                                    {inscription.nom?.charAt(0)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-text-main dark:text-white">
                                                                {inscription.nom} {inscription.prenom}
                                                            </p>
                                                            <p className="text-xs text-text-secondary">
                                                                {inscription.telephone || "N/A"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-mono text-sm text-primary">
                                                    {inscription.reference_id || "N/A"}
                                                </td>
                                                <td className="p-4 text-text-secondary">
                                                    {inscription.chef_quartier?.nom_complet || "Présentiel"}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="font-bold text-emerald-600">
                                                        {formatMontant(inscription.montant_total_paye)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="text-red-500">
                                                        {formatMontant(
                                                            (inscription.montant_requis || 4000) -
                                                            (inscription.montant_total_paye || 0)
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedInscription(inscription);
                                                                setModalOpen(true);
                                                            }}
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            Détails
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700"
                                                            onClick={() => handleValidate(inscription.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            <CheckCircle className="h-4 w-4 mr-1" />
                                                            Valider
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleReject(inscription.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Detail Modal */}
            {modalOpen && selectedInscription && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg p-6 animate-fade-in">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-lg font-bold text-text-main dark:text-white">
                                Détails de l'inscription
                            </h3>
                            <button
                                onClick={() => {
                                    setModalOpen(false);
                                    setSelectedInscription(null);
                                }}
                                className="text-text-secondary hover:text-text-main"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Photo */}
                            <div className="flex justify-center">
                                <div className="h-24 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    {selectedInscription.photo_url ? (
                                        <img
                                            src={selectedInscription.photo_url}
                                            alt={selectedInscription.nom}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-3xl text-gray-400">
                                            {selectedInscription.nom?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-text-secondary">Nom complet</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {selectedInscription.nom} {selectedInscription.prenom}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-secondary">Téléphone</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {selectedInscription.telephone || "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-secondary">Président de section</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {selectedInscription.chef_quartier?.nom_complet || "Présentiel"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-secondary">Date d'inscription</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {new Date(selectedInscription.created_at).toLocaleDateString("fr-FR")}
                                    </p>
                                </div>
                            </div>

                            {/* Payment Info */}
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="h-5 w-5 text-emerald-600" />
                                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                        Détails du paiement
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-emerald-700 dark:text-emerald-400">Montant payé</p>
                                        <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                            {formatMontant(selectedInscription.montant_total_paye)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-emerald-700 dark:text-emerald-400">Montant requis</p>
                                        <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                            {formatMontant(selectedInscription.montant_requis || 4000)}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-emerald-300 dark:border-emerald-700">
                                    <p className="text-emerald-700 dark:text-emerald-400 text-sm">Reste à payer</p>
                                    <p className="font-bold text-red-600 text-xl">
                                        {formatMontant(
                                            (selectedInscription.montant_requis || 4000) -
                                            (selectedInscription.montant_total_paye || 0)
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setModalOpen(false);
                                    setSelectedInscription(null);
                                }}
                            >
                                Fermer
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => handleReject(selectedInscription.id)}
                                disabled={actionLoading}
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Refuser
                            </Button>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleValidate(selectedInscription.id)}
                                disabled={actionLoading}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Valider le paiement
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
