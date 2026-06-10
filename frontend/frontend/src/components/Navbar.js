import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link href="" className="navbar-brand">
          Metaverso Arte
        </Link>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav">
            <li className="nav-item">
              <Link href="" className="nav-link">
                Inicio
              </Link>
            </li>
            <li className="nav-item">
              <Link href="" className="nav-link">
                Obras
              </Link>
            </li>
            <li className="nav-item">
              <Link href="" className="nav-link">
                Ventas
              </Link>
            </li>
            <li className="nav-item">
              <Link href="" className="nav-link">
                Ferias
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}