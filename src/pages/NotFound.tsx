const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-background text-foreground">
    <div className="text-center space-y-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Pagina non trovata</p>
      <a href="/" className="text-primary underline">
        Torna all'inizio
      </a>
    </div>
  </div>
);

export default NotFound;
