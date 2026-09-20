import Topbar from "@/components/Topbar";
import Container from "@/components/Container";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AgendaPage() {
  return (
    <div>
      <Topbar />
      <Container>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <div className="tdg-kicker">Operationele planning</div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">Agenda</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Selecteer een tijdsblok, kies de klant en plan meteen in.
            </p>
          </div>
          <div className="text-xs text-zinc-400">Europe/Brussels · 15 min planning</div>
        </div>
        <CalendarClient />
      </Container>
    </div>
  );
}
