// Logo officiel SEFIMAP — composant unique utilisé partout où le logo doit apparaître.
// Le fichier image doit se trouver dans `public/logo-sefimap.jpg`.
export function Logo({ className = "h-10 w-10" }) {
    return (
        <img
            src="/logo-sefimap.jpg"
            alt="Logo SEFIMAP"
            className={`${className} rounded-lg bg-white object-contain`}
        />
    );
}
