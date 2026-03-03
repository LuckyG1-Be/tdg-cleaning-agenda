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
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Agenda</h1>
            <p className="text-sm text-zinc-500">Dag-, week- en maandweergave met recurrenties.</p>
          </div>
          <div className="text-xs text-zinc-500">Tijdzone: Europe/Brussels</div>
        </div>
        <CalendarClient />
      </Container>
    </div>
  );
}
