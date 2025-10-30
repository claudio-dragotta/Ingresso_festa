import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invitee, Stats } from "../api/invitees";
import { searchInvitees, fetchStats, checkInPerson } from "../api/invitees";
import { useAuth } from "../context/AuthContext";
import "./SearchPage.css";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Debounce della ricerca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch statistiche
  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5000, // Aggiorna ogni 5 secondi
  });

  // Fetch risultati ricerca
  const { data: results = [], isLoading } = useQuery<Invitee[]>({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchInvitees(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  // Mutation per check-in
  const checkInMutation = useMutation({
    mutationFn: ({ id, adminOverride }: { id: string; adminOverride: boolean }) =>
      checkInPerson(id, adminOverride),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const handleCheckIn = (person: Invitee) => {
    // Solo admin può rimettere come "non entrato"
    const adminOverride = isAdmin && person.hasEntered;
    checkInMutation.mutate({ id: person.id, adminOverride });
  };

  const canClick = (person: Invitee) => {
    // Utenti ENTRANCE non possono cliccare su rosso (già entrato)
    // Admin può sempre cliccare
    return isAdmin || !person.hasEntered;
  };

  return (
    <div className="search-page">
      {/* Header con statistiche - sempre visibile */}
      <div className="stats-header">
        <div className="stat-card paganti">
          <div className="stat-label">Paganti</div>
          <div className="stat-value">{stats?.paganti.remaining ?? 0}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Green</div>
          <div className="stat-value">{stats?.green.remaining ?? 0}</div>
        </div>
        <div className="stat-card total">
          <div className="stat-label">Entrati</div>
          <div className="stat-value">{stats?.total.entered ?? 0}</div>
        </div>
      </div>

      {/* Barra di ricerca - sempre visibile */}
      <div className="search-container">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Cerca persona..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="clear-button"
              onClick={() => setSearchQuery("")}
              aria-label="Pulisci ricerca"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {searchQuery && searchQuery.length < 2 && (
          <div className="search-hint">Digita almeno 2 caratteri...</div>
        )}
      </div>

      {/* Risultati */}
      <div className="results-container">
        {isLoading && debouncedQuery.length >= 2 && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Ricerca in corso...</p>
          </div>
        )}

        {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
              <path d="M11 8v3m0 3h.01" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h3>Nessun risultato</h3>
            <p>Nessuna persona trovata per "{debouncedQuery}"</p>
          </div>
        )}

        {!isLoading && debouncedQuery.length >= 2 && results.length > 0 && (
          <>
            <div className="results-count">
              {results.length} {results.length === 1 ? "risultato" : "risultati"}
            </div>
            <div className="results-list">
              {results.map((person) => (
                <div key={person.id} className="result-card">
                  <div className="result-info">
                    <div className="result-name">
                      {person.lastName} {person.firstName}
                    </div>
                    <div className="result-meta">
                      <span className={`badge ${person.listType.toLowerCase()}`}>
                        {person.listType === "PAGANTE" ? "Pagante" : "Green"}
                      </span>
                      {person.paymentType && (
                        <span className="payment-type">{person.paymentType}</span>
                      )}
                    </div>
                  </div>

                  <button
                    className={`status-button ${person.hasEntered ? "entered" : "not-entered"} ${
                      !canClick(person) ? "disabled" : ""
                    }`}
                    onClick={() => canClick(person) && handleCheckIn(person)}
                    disabled={checkInMutation.isPending || !canClick(person)}
                  >
                    <svg className="status-icon" viewBox="0 0 24 24" fill="currentColor">
                      {person.hasEntered ? (
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      ) : (
                        <circle cx="12" cy="12" r="10"/>
                      )}
                    </svg>
                    <span>{person.hasEntered ? "Entrato" : "Entra"}</span>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {!searchQuery && (
          <div className="welcome-state">
            <svg className="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Cerca Persona</h2>
            <p>Digita nome o cognome per iniziare</p>
          </div>
        )}
      </div>
    </div>
  );
}
