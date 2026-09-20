import Topbar from "@/components/Topbar";
import Container from "@/components/Container";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function KlantenPage() {
  return (
    <div>
      <Topbar />
      <Container>
        <div className="mb-4">
          <div className="tdg-kicker">Relatiebeheer</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">Klanten</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Beheer klantgegevens en plan vanuit één klik een nieuwe afspraak.
          </p>
        </div>
        <CustomersClient />
      </Container>
    </div>
  );
}
