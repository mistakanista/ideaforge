# IdeaForge: User Journey einer Idee

Die Reise einer Idee von der Einreichung bis zur Umsetzung oder Ablehnung, für normale und für **vertrauliche** Ideen.
Quellen: `requirements/requirements.md`, `requirements/UserStories/1–10`, `CLAUDE.md`, `design/DatenModel/V2-StammdatenIntegriert/ideaforge_datenmodell.md` sowie Vorgaben aus dem Chat vom 2026-10-08.

## 1. Rollen & Rechte

| Aktion | Staff | Reviewer / Innovation Panel | Admin |
|---|---|---|---|
| Idee einreichen | ✅ | ✅ | ✅ |
| Dashboard ansehen, suchen, filtern | ✅ | ✅ | ✅ |
| Vertrauliche Ideen sehen | nur eigene | ✅ | nur eigene |
| Voten (1 Stimme pro Person und Idee) | ✅ | ✅ | ✅ |
| Kommentieren | ✅ | ✅ | ✅ |
| Idee bewerten (Score 1–5) | ❌ | ✅, aber **nie die eigene Idee** | ❌ |
| Stage ändern / ablehnen | ❌ | ✅, aber **nie die eigene Idee** | ❌ |
| User und Kategorien verwalten | ❌ | ❌ | ✅ |

## 2. Normale und vertrauliche Idee im Vergleich

Regel aus `CLAUDE.md` und US-1: Vertrauliche Ideen sind **nur für den Submitter und die Reviewer (Innovation Panel)** sichtbar. Ablauf, Stages, Bewertung, Ablehnung und Second Chance sind identisch, nur die Sichtbarkeit unterscheidet sich.

| Schritt | Normale Idee | Vertrauliche Idee |
|---|---|---|
| Sichtbarkeit | alle User | nur Submitter und Reviewer; **nicht** Kolleg:innen, **nicht** Admins |
| Dashboard / Suche | für alle auffindbar | nur in der Ansicht von Submitter und Reviewern |
| Voten | alle User | nur wer die Idee sieht (Submitter, Reviewer) |
| Kommentare | alle User | nur Submitter und Reviewer |
| Bewerten / Stage ändern | Reviewer, nie die eigene Idee | gleich |
| Benachrichtigungen | an den Submitter | gleich |
| Stages, Ablehnung, Second Chance | Submitted → Reviewing → Piloting → Implemented, Declined | gleich |

## 3. User Journey

Die Werte zeigen die Zufriedenheit je Schritt: 1 = frustriert, 5 = begeistert. Die Beschriftungen sind bewusst kurz, weil Mermaid lange Texte in diesem Diagrammtyp abschneidet.

```mermaid
journey
    title User Journey einer Idee in IdeaForge
    section Einreichen
      Mit Google anmelden: 4: Submitter
      Formular ausfüllen: 3: Submitter
      Ähnliche Ideen prüfen: 3: Submitter
      Optional vertraulich: 4: Submitter
      Absenden, Submitted: 5: Submitter
    section Feedback normal
      Im Dashboard sichtbar: 5: Submitter, Kollegen
      Voten: 4: Kollegen
      Kommentieren: 4: Kollegen
      Info über Kommentar: 4: Submitter
    section Feedback vertraulich
      Nur Submitter und Reviewer: 5: Submitter, Reviewer
      Kollegen und Admins sehen nichts: 4: Submitter
      Rückfrage eines Reviewers: 4: Reviewer, Submitter
    section Review
      Stage Reviewing: 4: Reviewer, Submitter
      Score Costs, Feasibility, Impact: 3: Reviewer
      Panel bespricht: 3: Innovation Panel
      Weiter oder ablehnen: 3: Innovation Panel, Submitter
    section Pilot
      Stage Piloting: 5: Submitter, Innovation Panel
      Pilot bewerten: 3: Reviewer
    section Umsetzung
      Stage Implemented: 5: Submitter, Innovation Panel
    section Ablehnung
      Begründung lesen: 2: Submitter
      Einmal neu einreichen: 3: Submitter
```

Je nach Markierung durchläuft eine Idee **entweder** „Feedback normal“ **oder** „Feedback vertraulich“.

## 4. Ablauf mit Entscheidungen

```mermaid
flowchart TD
    subgraph SUB["Submitter (jeder User)"]
        A([Start: Login mit Google]) --> B["Idee anlegen:<br/>Titel, Problem, Lösung,<br/>Kategorie, erwarteter Impact"]
        B --> C{"Vertraulich?"}
        C -- ja --> C1["Nur für Submitter und<br/>Reviewer sichtbar"]
        C -- nein --> C2["Für alle sichtbar"]
        C1 --> D["Absenden<br/>Office und User werden<br/>automatisch gespeichert"]
        C2 --> D
        N1["Benachrichtigung über<br/>Stage-Wechsel und Begründung"]
        R1{"Schon einmal<br/>abgelehnt worden?"}
        R1 -- "nein, 1. Ablehnung" --> R2["Überarbeiten und<br/>einmal neu einreichen<br/>(Second Chance)"]
        R1 -- "ja, 2. Ablehnung" --> X([Endgültig abgelehnt])
        R2 --> B
    end

    subgraph ALL["Alle User, die die Idee sehen dürfen"]
        E["Dashboard: suchen, filtern<br/>nach Kategorie, Office, Votes"]
        F["Voten<br/>(1 Stimme pro Person)"]
        G["Kommentieren"]
        E --> F
        E --> G
    end

    subgraph REV["Reviewer / Innovation Panel"]
        H{"Eigene Idee?"}
        H -- ja --> H1["Anderer Reviewer<br/>übernimmt"]
        H1 --> I
        H -- nein --> I["Bewerten je 1 bis 5:<br/>Costs, Feasibility, Impact"]
        I --> J{"Entscheidung"}
        J -- weiter --> K["Nächste Stage<br/>(kein Überspringen)"]
        J -- ablehnen --> L["Begründung angeben<br/>(Pflicht)"]
        L --> M["Stage: Declined"]
    end

    D --> S1[["Stage: Submitted"]]
    S1 -- "normal: alle<br/>vertraulich: nur Submitter<br/>und Reviewer" --> E
    S1 --> H
    K --> S2[["Submitted → Reviewing<br/>→ Piloting → Implemented"]]
    S2 -- "noch nicht Implemented" --> H
    S2 -- "Implemented" --> Z([Idee umgesetzt])
    K --> N1
    M --> N1
    G --> N1
    N1 -- "bei Declined" --> R1
```

Hinweis: Admins reichen wie alle anderen Ideen ein, bewerten aber nicht und verschieben keine Stages.

## 5. Sichtbarkeit einer vertraulichen Idee

```mermaid
flowchart LR
    I[["Vertrauliche Idee"]]
    I -- "sieht, kommentiert,<br/>erhält Benachrichtigungen" --> S["Submitter"]
    I -- "sieht, kommentiert,<br/>bewertet, ändert Stage" --> R["Reviewer / Innovation Panel"]
    I -. "nicht sichtbar" .-> K["Kolleginnen und Kollegen"]
    I -. "nicht sichtbar" .-> A["Admin"]
    R --> C{"Eigene Idee?"}
    C -- ja --> C1["Darf nur sehen,<br/>nicht bewerten"]
    C -- nein --> C2["Darf bewerten<br/>und Stage ändern"]
```

## 6. Sequenz: wer macht was?

```mermaid
sequenceDiagram
    autonumber
    actor S as Submitter
    participant App as IdeaForge
    actor K as Kollegen und Admins
    actor R as Reviewer
    actor P as Innovation Panel

    S->>App: Idee anlegen (Titel, Problem, Lösung, Kategorie, Impact, optional vertraulich)
    App-->>S: Gespeichert mit ID, Stage Submitted
    alt Idee ist nicht vertraulich
        K->>App: Voten und kommentieren
        App-->>S: Benachrichtigung über Kommentar
    else Idee ist vertraulich
        K-xApp: Dashboard und Suche
        Note over K,App: Vertrauliche Idee wird nicht angezeigt
        R->>App: Rückfrage als Kommentar
        App-->>S: Benachrichtigung über Kommentar
        S->>App: Antwort als Kommentar
    end
    R->>App: Stage auf Reviewing setzen
    App-->>S: Benachrichtigung über Stage-Wechsel
    R->>App: Bewertung Costs, Feasibility, Impact (je 1 bis 5)
    Note over R,App: Nicht erlaubt bei eigener Idee. Admins bewerten nicht.
    R->>P: Idee mit Scores für das Panel vorbereiten
    alt Panel stimmt zu
        P->>App: Stage auf Piloting setzen, mit Begründung
        App-->>S: Benachrichtigung mit Begründung
        P->>App: Nach erfolgreichem Pilot Stage auf Implemented setzen
        App-->>S: Benachrichtigung: Idee umgesetzt
    else Panel lehnt ab (in jeder aktiven Stage möglich)
        P->>App: Stage auf Declined setzen, Begründung Pflicht
        App-->>S: Benachrichtigung mit Begründung
        opt Erste Ablehnung
            S->>App: Überarbeitete Idee einmal neu einreichen
        end
    end
```

## 7. Stage-Modell

```mermaid
stateDiagram-v2
    [*] --> Submitted : Jeder User reicht ein
    Submitted --> Reviewing : Reviewer
    Reviewing --> Piloting : Panel, nach Bewertung
    Piloting --> Implemented : Panel
    Implemented --> [*]

    Submitted --> Declined : Begründung Pflicht
    Reviewing --> Declined : Begründung Pflicht
    Piloting --> Declined : Begründung Pflicht

    Declined --> Submitted : Second Chance, nur einmal
    Declined --> [*] : nach 2. Ablehnung endgültig

    note right of Reviewing
        Score je 1 bis 5
        Costs, Feasibility, Impact
        Nur Reviewer und Panel,
        nie die eigene Idee
    end note
```

Regeln, gültig für normale und vertrauliche Ideen:
- Keine Stage darf übersprungen werden.
- Ablehnen geht aus jeder aktiven Stage.
- Nur Reviewer bzw. das Innovation Panel ändern Stages.
- Der Submitter sieht bei jedem Wechsel die Begründung.

## 8. Offene Punkte

### Abweichungen zu bestehenden Dokumenten

| # | Thema | Diese User Journey | Bestehende Dokumente | Zu klären |
|---|---|---|---|---|
| 1 | Name der 2. Stage | **Reviewing** | „Under Review“ (requirements.md, US-3), `UNDER_REVIEW` (Datenmodell V2) | Einheitlichen Namen festlegen und Dokumente angleichen |
| 2 | Score-Skala | **1–5** | 0–5 (requirements.md, US-3) | Skala festlegen, `scoring_criterion.min_score` anpassen |
| 3 | Bedeutung Cost-Score | – | „cost 5 means least costs“ (requirements.md) | Bestätigen: 5 = geringste Kosten, damit gilt überall „höher = besser“ |
| 4 | Begründung | Pflicht bei Ablehnung | US-3: Begründung mit Scores bei **jedem** Stage-Wechsel; Datenmodell: `reason` immer Pflicht | Pflicht nur bei Ablehnung oder bei jedem Wechsel? |
| 5 | Second Chance | Abgelehnte Idee einmal neu einreichen | Datenmodell: als **neue** Idee mit `attempt_no = 2` | Diagramm vereinfacht das als Rückkehr zu Submitted |

### Vertrauliche Ideen (nicht in den Requirements geregelt)

| # | Frage | Warum relevant |
|---|---|---|
| 6 | Bleibt eine vertrauliche Idee auch nach **Implemented** vertraulich, oder wird sie dann öffentlich? | Umgesetzte Ideen sind oft für alle interessant |
| 7 | Darf der Submitter die Markierung „vertraulich“ später **ändern**? | Nicht in den Requirements geregelt |
| 8 | Übernimmt eine neu eingereichte Idee (Second Chance) die Markierung? | Neue Idee mit `attempt_no = 2` im Datenmodell |
| 9 | Zählen vertrauliche Ideen in den **Dashboard-Statistiken** (nach Stage, Kategorie, Office) mit, z. B. anonym als Anzahl? | US-2 Dashboard für alle User |
| 10 | Dürfen Reviewer vertrauliche Ideen **voten**? | Voting ist sonst ein Signal der Kolleg:innen, das hier fehlt |
