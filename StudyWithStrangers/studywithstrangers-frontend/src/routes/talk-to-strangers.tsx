import { createFileRoute } from "@tanstack/react-router";
import { SeoPage } from "@/components/studywithstrangers/SeoPage";
import { getSeoPage, seoHead } from "@/lib/seoPages";

const page = getSeoPage("talk-to-strangers");

export const Route = createFileRoute("/talk-to-strangers")({
  head: () => seoHead(page),
  component: () => <SeoPage page={page} />,
});
