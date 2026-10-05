import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
    ArrowLeft,
    User,
    Phone,
    Mail,
    Calendar,
    MapPin,
    CreditCard,
    Wallet,
    CheckCircle,
    AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
    getFinanceBadgeClasses,
    getFinanceStatusMeta,
    getRemainingDue,
    REQUIRED_PAYMENT_AMOUNT,
} from "@/lib/finance";

export function RegistrationDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [inscription, setInscription] = useState(null);
    const [paiements, setPaiements] = useState([]);

    useEffect(() => {
        loadRegistrationDetails();
    }, [id]);

    const loadRegistrationDetails = async () => {
        setLoading(true);
        try {
            // Fetch inscription details
            const { data: inscriptionData } = await supabase
                .from('inscriptions')
                .select('*')
                .eq('id', id)
                .single();

            if (inscriptionData) {
                setInscription(inscriptionData);

                // Fetch payments for this inscription
                const { data: paymentsData } = await supabase
                    .from('paiements')
                    .select('*')
                    .eq('inscription_id', id)
                    .order('date_paiement', { ascending: false });

                setPaiements(paymentsData || []);
            }
        } catch (error) {
            console.error('Erreur chargement détails:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (currentInscription) => {
        const meta = getFinanceStatusMeta(currentInscription);
        return <Badge className={getFinanceBadgeClasses(meta.variant)}>{meta.label}</Badge>;
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat('fr-FR').format(montant || 0) + ' FCFA';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!inscription) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-text-main dark:text-white mb-2">
                            Inscription non trouvée
                        </h2>
                        <p className="text-text-secondary mb-6">
                            Cette inscription n'existe pas ou a été supprimée.
                        </p>
                        <Button onClick={() => navigate('/admin/President')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Retour au dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const resteAPayer = getRemainingDue(inscription);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-4 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/admin/President')}
                            className="gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Retour</span>
                        </Button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-text-main dark:text-white">
                                Détails du Participant
                            </h1>
                            <p className="text-sm text-text-secondary">
                                {inscription.nom} {inscription.prenom}
                            </p>
                        </div>
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            {/* Content */}
            <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
                {/* Photo & Info principale */}
                <Card>
                    <CardContent className="p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row items-start gap-6">
                            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                {inscription.photo_url ? (
                                    <img
                                        src={inscription.photo_url}
                                        alt={`${inscription.nom} ${inscription.prenom}`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-4xl text-gray-400">
                                        {inscription.nom?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 className="text-xl sm:text-2xl font-bold text-text-main dark:text-white">
                                        {inscription.nom} {inscription.prenom}
                                    </h2>
                                    {getStatusBadge(inscription)}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div className="flex items-center gap-2 text-text-secondary">
                                        <Calendar className="h-4 w-4" />
                                        <span>Âge: {inscription.age} ans</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-text-secondary">
                                        <User className="h-4 w-4" />
                                        <span>Genre: {inscription.sexe === 'homme' ? 'Homme' : 'Femme'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-text-secondary">
                                        <Phone className="h-4 w-4" />
                                        <span>{inscription.telephone || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-text-secondary">
                                        <Mail className="h-4 w-4" />
                                        <span>{inscription.email || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Paiement */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Informations de Paiement
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-xs text-text-secondary mb-1">Montant requis</p>
                                <p className="text-lg font-bold text-blue-600">{formatMontant(inscription.montant_requis || REQUIRED_PAYMENT_AMOUNT)}</p>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-xs text-text-secondary mb-1">Payé</p>
                                <p className="text-lg font-bold text-green-600">
                                    {formatMontant(inscription.montant_total_paye)}
                                </p>
                            </div>
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <p className="text-xs text-text-secondary mb-1">Reste à payer</p>
                                <p className="text-lg font-bold text-red-600">
                                    {formatMontant(resteAPayer)}
                                </p>
                            </div>
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <p className="text-xs text-text-secondary mb-1">Progression</p>
                                <p className="text-lg font-bold text-purple-600">
                                    {Math.round(((inscription.montant_total_paye || 0) / (inscription.montant_requis || REQUIRED_PAYMENT_AMOUNT)) * 100)}%
                                </p>
                            </div>
                        </div>

                        {/* Barre de progression */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-text-secondary">Progression du paiement</span>
                                <span className="font-medium text-text-main dark:text-white">
                                    {formatMontant(inscription.montant_total_paye)} / {formatMontant(inscription.montant_requis || REQUIRED_PAYMENT_AMOUNT)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all"
                                    style={{ width: `${Math.min(((inscription.montant_total_paye || 0) / (inscription.montant_requis || REQUIRED_PAYMENT_AMOUNT)) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Historique des paiements */}
                {paiements.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Wallet className="h-5 w-5" />
                                Historique des Paiements ({paiements.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {paiements.map((paiement, index) => (
                                    <div
                                        key={paiement.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg gap-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    Paiement #{index + 1}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {formatDate(paiement.date_paiement)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-bold text-green-600">
                                                    {formatMontant(paiement.montant)}
                                                </p>
                                                <p className="text-xs text-text-secondary capitalize">
                                                    {paiement.mode_paiement || 'Espèces'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Autres informations */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            Informations Complémentaires
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-text-secondary mb-1">Niveau d'étude</p>
                                <p className="font-medium text-text-main dark:text-white capitalize">
                                    {inscription.niveau_etude || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary mb-1">Numéro parent/tuteur</p>
                                <p className="font-medium text-text-main dark:text-white">
                                    {inscription.numero_parent || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary mb-1">Date d'inscription</p>
                                <p className="font-medium text-text-main dark:text-white">
                                    {formatDate(inscription.created_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary mb-1">Statut workflow</p>
                                <p className="font-medium text-text-main dark:text-white capitalize">
                                    {(() => {
                                        // Si workflow_status existe, l'utiliser
                                        if (inscription.workflow_status) {
                                            return inscription.workflow_status.replace('_', ' ');
                                        }
                                        // Sinon, déduire le statut à partir du paiement
                                        if (inscription.statut_paiement === 'soldé' || inscription.statut_paiement === 'valide_financier') {
                                            return 'En attente secrétariat';
                                        } else if (inscription.statut_paiement === 'en_attente_validation') {
                                            return 'En attente finance';
                                        } else if (inscription.statut_paiement === 'partiel' || inscription.statut_paiement === 'non_payé') {
                                            return 'En attente finance';
                                        }
                                        return 'Non défini';
                                    })()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Bouton retour en bas (mobile) */}
                <div className="sm:hidden">
                    <Button
                        onClick={() => navigate('/admin/President')}
                        className="w-full gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour au dashboard
                    </Button>
                </div>
            </main>
        </div>
    );
}
