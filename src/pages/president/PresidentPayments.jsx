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

export function PresidentPayments() {
    const { president } = useOutletContext();
    const [loading, setLoading] = useState(true);
    const [inscriptions, setInscriptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("non_solde");
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
            let query = supabase
                .from("inscriptions")
                .select("*")
                .eq("chef_quartier_id", president.id)
                .order("created_at", { ascending: false });

            if (filterStatus === "non_solde") {
                query = query.neq("statut_paiement", "soldé").neq("statut_paiement", "valide_financier");
            } else if (filterStatus === "solde") {
                query = query.or("statut_paiement.eq.soldé,statut_paiement.eq.valide_financier");
            }

            const { data, error } = await query;

            if (error) throw error;
            setInscriptions(data || []);

            // Calculate stats
            const allData = await supabase
                .from("inscriptions")
                .select("montant_total_paye, statut_paiement")
                .eq("chef_quartier_id", president.id);

            if (allData.data) {
                const totalCollected = allData.data.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0);
                const totalRequired = allData.data.length * 4000;
                const fullyPaid = allData.data.filter(
                    (i) => i.statut_paiement === "soldé" || i.statut_paiement === "valide_financier"
                ).length;
                const partiallyPaid = allData.data.filter((i) => i.statut_paiement === "partiel").length;

                setStats({
                    totalMembers: allData.data.length,
                    totalCollected,
                    totalPending: totalRequired - totalCollected,
                    fullyPaid,
                    partiallyPaid,
                });
            }
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
            alert("Veuillez entrer un montant valide");
            return;
        }

        const amount = parseFloat(paymentAmount);
        const remaining = 4000 - (selectedInscription.montant_total_paye || 0);

        if (amount > remaining) {
            alert(`Le montant ne peut pas dépasser ${remaining} FCFA (reste à payer)`);
            return;
        }

        setIsSubmitting(true);
        try {
            // Add payment record
            const { error: paymentError } = await supabase.from("paiements").insert({
                inscription_id: selectedInscription.id,
                montant: amount,
                mode_paiement: paymentMode,
                statut: "validé",
                type_paiement: "inscription",
            });

            if (paymentError) throw paymentError;

            // Update inscription total
            const newTotal = (selectedInscription.montant_total_paye || 0) + amount;
            let newStatus = "partiel";
            if (newTotal >= 4000) {
                newStatus = "soldé";
            }

            const { error: updateError } = await supabase
                .from("inscriptions")
                .update({
                    montant_total_paye: newTotal,
                    statut_paiement: newStatus,
                })
                .eq("id", selectedInscription.id);

            if (updateError) throw updateError;

            // Refresh data
            setModalOpen(false);
            setSelectedInscription(null);
            loadInscriptions();
        } catch (error) {
            console.error("Erreur ajout paiement:", error);
            alert("Erreur lors de l'ajout du paiement");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "soldé":
            case "valide_financier":
                return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Soldé</Badge>;
            case "partiel":
                return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partiel</Badge>;
            default:
                return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Non payé</Badge>;
        }
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
                                            {getStatusBadge(inscription.statut_paiement)}
                                            {inscription.statut_paiement !== "soldé" &&
                                                inscription.statut_paiement !== "valide_financier" && (
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
                                            Reste: {formatMontant(4000 - (selectedInscription.montant_total_paye || 0))}
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
