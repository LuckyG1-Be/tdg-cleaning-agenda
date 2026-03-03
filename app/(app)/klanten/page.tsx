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
          <h1 className="text-2xl font-semibold">Klanten</h1>
          <p className="text-sm text-zinc-500">Beheer je klantendatabase (geen verplichte velden).</p>
        </div>
        <CustomersClient />
      </Container>
    </div>
  );
}
