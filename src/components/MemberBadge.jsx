import { COMMISSIONS } from "@/lib/commissions";

// Les coordonnées correspondent au modèle fourni, quel que soit son format d'affichage.
export function MemberBadge({ member, badgeRef }) {
    const color = COMMISSIONS.find((item) => item.nom === member?.commission)?.couleur || "#a84616";
    const fullName = `${member?.nom || ""} ${member?.prenom || ""}`.trim();
    const commissionSize = member?.commission?.length > 45 ? 12 : member?.commission?.length > 25 ? 15 : 19;
    const nameSize = fullName.length > 35 ? 17 : fullName.length > 22 ? 21 : 26;

    return (
        <div ref={badgeRef} style={{ width: 350, height: 493, position: "relative", overflow: "hidden", background: "white", fontFamily: "Georgia, serif" }}>
            <img src="/images/badge-modele-2026.png" alt="" style={{ position: "absolute", width: "100%", height: "100%", inset: 0 }} />
            <div style={{ position: "absolute", left: "25%", top: "14.5%", width: "50%", height: "42%", overflow: "hidden", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {member?.photo_url && <img src={member.photo_url} alt={`Photo de ${fullName}`} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />}
            </div>
            <div style={{ position: "absolute", left: "8%", top: "65.5%", width: "84%", height: "8%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color, fontSize: commissionSize, lineHeight: 1.05, fontStyle: "italic", textTransform: "uppercase", overflowWrap: "anywhere" }}>
                {member?.commission || ""}
            </div>
            <div style={{ position: "absolute", left: "7%", top: "81.5%", width: "86%", height: "14%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color, fontSize: nameSize, lineHeight: 1.05, fontStyle: "italic", textTransform: "uppercase", overflowWrap: "anywhere" }}>
                {fullName}
            </div>
        </div>
    );
}
