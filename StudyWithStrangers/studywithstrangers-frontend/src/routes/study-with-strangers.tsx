import { createFileRoute } from "@tanstack/react-router";
import { SeoPage } from "@/components/studywithstrangers/SeoPage";
import { getSeoPage, seoHead } from "@/lib/seoPages";

const page = getSeoPage("study-with-strangers");

export const Route = createFileRoute("/study-with-strangers")({
  head: () => seoHead(page),
  component: () => <SeoPage page={page} />,
});
