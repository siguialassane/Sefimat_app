import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
    Search,
    CreditCard,
    User,
    Phone,
    Plus,
    X,
    Check,
    AlertCircle,
    History,
    Wallet,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";
import {
    canAddPayment,
    getFinanceBadgeClasses,
    getFinanceStatusMeta,
    isFullyPaid,
    isPresidentBlockedForPayment,
} from "@/lib/finance";

export function PresidentPayments() {
    const { president } = useOutletContext();
    const [loading, setLoading] = useState(true);
    const [inscriptions, setInscriptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [selectedInscription, setSelectedInscription] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMode, setPaymentMode] = useState("especes");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stats, setStats] = useState({
        totalMembers: 0,
        totalCollected: 0,
        totalPending: 0,
        fullyPaid: 0,
        partiallyPaid: 0,
    });

    useEffect(() => {
        if (president?.id) {
            loadInscriptions();
        }
    }, [president?.id, filterStatus]);

    const loadInscriptions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("inscriptions")
                .select("*")
                .eq("chef_quartier_id", president.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            const allInscriptions = data || [];

            const visibleInscriptions = allInscriptions.filter((inscription) => {
                if (filterStatus === "non_solde") return !isFullyPaid(inscription);
                if (filterStatus === "solde") return isFullyPaid(inscription);
                return true;
            });

            setInscriptions(visibleInscriptions);

            const totalCollected = allInscriptions.reduce((acc, inscription) => acc + (inscription.montant_total_paye || 0), 0);
            const totalRequired = allInscriptions.length * 4000;
            const fullyPaid = allInscriptions.filter(isFullyPaid).length;
            const partiallyPaid = allInscriptions.filter(
                (inscription) => (inscription.montant_total_paye || 0) > 0 && !isFullyPaid(inscription)
            ).length;

            setStats({
                totalMembers: allInscriptions.length,
                totalCollected,
                totalPending: Math.max(0, totalRequired - totalCollected),
                fullyPaid,
                partiallyPaid,
            });
        } catch (error) {
            console.error("Erreur chargement:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadPaymentHistory = async (inscriptionId) => {
        try {
            const { data, error } = await supabase
                .from("paiements")
                .select("*")
                .eq("inscription_id", inscriptionId)
                .order("date_paiement", { ascending: false });

            if (!error) {
                setPaymentHistory(data || []);
            }
        } catch (err) {
            console.error("Erreur historique:", err);
        }
    };

    const openPaymentModal = async (inscription) => {
        setSelectedInscription(inscription);
        setPaymentAmount("");
        setPaymentMode("especes");
        await loadPaymentHistory(inscription.id);
        setModalOpen(true);
    };

    const handleAddPayment = async () => {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            notify.warning("Veuillez entrer un montant valide", { title: "Montant invalide" });
            return;
        }

        // Convertir en entier (INTEGER) pour correspondre au type de la fonction PostgreSQL
        const amount = Math.floor(parseFloat(paymentAmount));
        const remaining = (selectedInscription.montant_requis || 4000) - (selectedInscription.montant_total_paye || 0);

        if (amount > remaining) {
            notify.warning(`Le montant ne peut pas dépasser ${remaining} FCFA (reste à payer)`, { title: "Montant invalide" });
            return;
        }

        setIsSubmitting(true);
        try {
            console.log("PresidentPayments: Appel fonction add_payment avec montant:", amount);

            // Utiliser la fonction RPC - montant doit être INTEGER
            const { data, error } = await supabase.rpc('add_payment', {
                p_inscription_id: selectedInscription.id,
                p_montant: amount,  // INTEGER
                p_mode_paiement: paymentMode,
                p_type_paiement: 'inscription'
            });

            console.log("PresidentPayments: Résultat add_payment:", data);

            if (error) {
                console.error("PresidentPayments: Erreur RPC:", error);
                throw error;
            }

            if (!data.success) {
                throw new Error(data.error || "Erreur lors de l'ajout du paiement");
            }

            console.log("PresidentPayments: Paiement ajouté avec succès:", data);

            const requis = selectedInscription.montant_requis || 4000;
            let statutPaiement = "non_payé";
            if (data.new_total >= requis) statutPaiement = "soldé";
            else if (data.new_total > 0) statutPaiement = "partiel";

            // IMPORTANT: l'ajout d'argent ne touche JAMAIS au workflow (pas de régression).
            const syncStatus = {
                statut_paiement: statutPaiement,
            };
            // Si la finance avait abandonné un reliquat, le réduire du montant ajouté
            if ((selectedInscription.montant_non_du || 0) > 0) {
                syncStatus.montant_non_du = Math.max(0, requis - data.new_total);
            }

            const { error: inscriptionUpdateError } = await supabase
                .from("inscriptions")
                .update(syncStatus)
                .eq("id", selectedInscription.id);

            if (inscriptionUpdateError) {
                throw inscriptionUpdateError;
            }

            // Refresh data
            setModalOpen(false);
            setSelectedInscription(null);
            setPaymentAmount("");
            loadInscriptions();

            // Afficher un message de succès
            notify.success(`Paiement de ${amount.toLocaleString()} FCFA enregistré. Nouveau total: ${data.new_total.toLocaleString()} FCFA`, {
                title: "Paiement enregistré",
            });
        } catch (error) {
            console.error("PresidentPayments: Erreur ajout paiement:", error);
            notify.error("Erreur lors de l'ajout du paiement: " + (error.message || "Erreur inconnue"), {
                title: "Échec paiement",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const getStatusBadge = (inscription) => {
        const meta = getFinanceStatusMeta(inscription);
        return <Badge className={getFinanceBadgeClasses(meta.variant)}>{meta.label}</Badge>;
    };

    const filteredInscriptions = inscriptions.filter((i) =>
        `${i.nom} ${i.prenom}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex-shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                            Suivi des Paiements
                        </h1>
                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                            Gérez les paiements de vos membres ({president?.zone})
                        </p>
                    </div>
                    <Button onClick={loadInscriptions} variant="outline" className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-text-secondary">Total membres</p>
                                    <p className="text-xl font-bold text-text-main dark:text-white">
                                        {stats.totalMembers}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                                    <Wallet className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-text-secondary">Collecté</p>
                                    <p className="text-xl font-bold text-green-600">
                                        {formatMontant(stats.totalCollected)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                    <AlertCircle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-text-secondary">Reste à percevoir</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {formatMontant(stats.totalPending)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                    <Check className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-text-secondary">Soldés / Partiels</p>
                                    <p className="text-xl font-bold text-text-main dark:text-white">
                                        {stats.fullyPaid} / {stats.partiallyPaid}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                <Input
                                    placeholder="Rechercher par nom..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                <option value="non_solde">Non soldés</option>
                                <option value="solde">Soldés</option>
                                <option value="all">Tous</option>
                            </Select>
                        </div>
                    </Card>

                    {/* Members List */}
                    <Card>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-text-secondary">Chargement...</p>
                            </div>
                        ) : filteredInscriptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <User className="h-16 w-16 text-gray-300 mb-4" />
                                <p className="text-text-main dark:text-white text-lg font-medium">
                                    Aucun membre trouvé
                                </p>
                                <p className="text-text-secondary">
                                    {filterStatus === "non_solde"
                                        ? "Tous vos membres ont soldé leur paiement!"
                                        : "Aucune inscription correspondante"}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {filteredInscriptions.map((inscription) => (
                                    <div
                                        key={inscription.id}
                                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/5"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                                {inscription.photo_url ? (
                                                    <img
                                                        src={inscription.photo_url}
                                                        alt={inscription.nom}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-xl text-gray-400">
                                                        {inscription.nom?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    {inscription.nom} {inscription.prenom}
                                                </p>
                                                <p className="text-sm text-text-secondary flex items-center gap-2">
                                                    <Phone className="h-3 w-3" />
                                                    {inscription.telephone || inscription.numero_parent || "N/A"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 ml-16 md:ml-0">
                                            <div className="text-right">
                                                <p className="font-bold text-amber-600">
                                                    {formatMontant(inscription.montant_total_paye)}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    / {formatMontant(4000)}
                                                </p>
                                            </div>
                                            {getStatusBadge(inscription)}
                                            {isPresidentBlockedForPayment(inscription) && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700" title="Dossier validé par la finance : aucun encaissement à ajouter">
                                                    <Check className="h-3 w-3" />
                                                    Validé par la finance
                                                </span>
                                            )}
                                            {canAddPayment(inscription) && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-amber-600 hover:bg-amber-700"
                                                        onClick={() => openPaymentModal(inscription)}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Paiement
                                                    </Button>
                                                )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Payment Modal */}
            {modalOpen && selectedInscription && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg animate-fade-in">
                        <CardHeader className="border-b border-border-light dark:border-border-dark">
                            <div className="flex justify-between items-start">
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-amber-500" />
                                    Ajouter un paiement
                                </CardTitle>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="text-text-secondary hover:text-text-main"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {/* Member Info */}
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    {selectedInscription.photo_url ? (
                                        <img
                                            src={selectedInscription.photo_url}
                                            alt={selectedInscription.nom}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-2xl text-gray-400">
                                            {selectedInscription.nom?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-lg text-text-main dark:text-white">
                                        {selectedInscription.nom} {selectedInscription.prenom}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-amber-600 font-medium">
                                            Payé: {formatMontant(selectedInscription.montant_total_paye)}
                                        </span>
                                        <span className="text-text-secondary">|</span>
                                        <span className="text-red-500">
                                            Reste: {formatMontant(Math.max(0, (selectedInscription.montant_requis || 4000) - (selectedInscription.montant_total_paye || 0) - (selectedInscription.montant_non_du || 0)))}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Form */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="paymentAmount">Montant (FCFA) *</Label>
                                    <Input
                                        id="paymentAmount"
                                        type="number"
                                        min="1"
                                        max={4000 - (selectedInscription.montant_total_paye || 0)}
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="Ex: 1000"
                                        className="border-amber-300 focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <Label>Mode de paiement</Label>
                                    <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                                        <option value="especes">Espèces</option>
                                        <option value="mobile_money">Mobile Money</option>
                                        <option value="virement">Virement</option>
                                    </Select>
                                </div>
                            </div>

                            {/* Payment History */}
                            {paymentHistory.length > 0 && (
                                <div>
                                    <Label className="flex items-center gap-2 mb-2">
                                        <History className="h-4 w-4" />
                                        Historique des paiements
                                    </Label>
                                    <div className="max-h-32 overflow-y-auto border border-border-light dark:border-border-dark rounded-lg">
                                        {paymentHistory.map((payment) => (
                                            <div
                                                key={payment.id}
                                                className="p-3 flex justify-between items-center border-b last:border-b-0 border-border-light dark:border-border-dark"
                                            >
                                                <div>
                                                    <span className="font-medium text-amber-600">
                                                        +{formatMontant(payment.montant)}
                                                    </span>
                                                    <span className="text-xs text-text-secondary ml-2">
                                                        {payment.mode_paiement}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-text-secondary">
                                                    {new Date(payment.date_paiement).toLocaleDateString("fr-FR")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setModalOpen(false)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                                    onClick={handleAddPayment}
                                    disabled={isSubmitting || !paymentAmount}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Enregistrement...
                                        </span>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-2" />
                                            Enregistrer
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
