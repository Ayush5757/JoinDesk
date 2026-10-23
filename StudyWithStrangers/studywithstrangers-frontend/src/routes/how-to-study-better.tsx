import { createFileRoute } from "@tanstack/react-router";
import { SeoPage } from "@/components/studywithstrangers/SeoPage";
import { getSeoPage, seoHead } from "@/lib/seoPages";

const page = getSeoPage("how-to-study-better");

export const Route = createFileRoute("/how-to-study-better")({
  head: () => seoHead(page),
  component: () => <SeoPage page={page} />,
});
