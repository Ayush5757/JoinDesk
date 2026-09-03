import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ShieldBan, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DeskGrid } from "./DeskGrid";
import { JoinersModal } from "./JoinersModal";
import { JoinDeskModal } from "./JoinDeskModal";
import { EditDeskModal, type EditDeskInput } from "./EditDeskModal";
import {
  getProfile,
  updateAvatar,
  blockUser,
  unblockUser,
  getUserDesksPage,
  type ProfileResponse,
} from "@/lib/users";
import { updateDesk, deleteDesk, setDeskHidden } from "@/lib/desks";
import { type Desk } from "@/lib/joindesk";
import { type AppUser } from "@/lib/auth";

const PAGE_SIZE = 15;

export function ProfileView({
  userId,
  currentUser,
}: {
  userId: string;
  currentUser: AppUser | null;
}) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [desks, setDesks] = useState<Desk[]>([]);
  const [loadingDesks, setLoadingDesks] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [viewJoinersDeskId, setViewJoinersDeskId] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<Desk | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Desk | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await getProfile(userId);
      setProfile(res);
    } catch {
      toast.error("Couldn't load this profile.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadDesks = async (fromOffset: number, reset: boolean) => {
    if (reset) setLoadingDesks(true);
    else setLoadingMore(true);
    try {
      const { desks: page, hasMore: more } = await getUserDesksPage(userId, PAGE_SIZE, fromOffset);
      setDesks((prev) => (reset ? page : [...prev, ...page]));
      setHasMore(more);
      setOffset(fromOffset + page.length);
    } catch {
      toast.error("Couldn't load this user's desks.");
    } finally {
      setLoadingDesks(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadProfile();
    setOffset(0);
    loadDesks(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const { user } = await updateAvatar(file);
      setProfile((prev) => (prev ? { ...prev, user: { ...prev.user, ...user } } : prev));
      toast.success("Profile picture updated.");
    } catch {
      toast.error("Couldn't update your profile picture. Try a smaller image (under 5MB).");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const toggleBlock = async () => {
    if (!profile) return;
    setBlockBusy(true);
    try {
      if (profile.iBlockedThem) {
        await unblockUser(userId);
        setProfile({ ...profile, iBlockedThem: false });
        toast.success(`Unblocked ${profile.user.name}.`);
      } else {
        await blockUser(userId);
        setProfile({ ...profile, iBlockedThem: true });
        toast.success(`Blocked ${profile.user.name}. Their future desks won't show up for you.`);
      }
    } catch {
      toast.error("That didn't go through. Try again.");
    } finally {
      setBlockBusy(false);
    }
  };

  const handleEditSave = async (input: EditDeskInput) => {
    if (!editTarget) return;
    const updated = await updateDesk(editTarget.id, input);
    setDesks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setIsEditModalOpen(false);
    toast.success("Desk updated.");
  };

  const handleDeleteDesk = async (desk: Desk) => {
    if (!confirm(`Delete "${desk.title}"? This can't be undone.`)) return;
    try {
      await deleteDesk(desk.id);
      setDesks((prev) => prev.filter((d) => d.id !== desk.id));
      toast.success("Desk deleted.");
    } catch {
      toast.error("Couldn't delete that desk. Try again.");
    }
  };

  const handleToggleHide = async (desk: Desk) => {
    try {
      const updated = await setDeskHidden(desk.id, !desk.isHidden);
      setDesks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      toast.success(updated.isHidden ? "Desk hidden from the dashboard." : "Desk is visible again.");
    } catch {
      toast.error("That didn't go through. Try again.");
    }
  };

  if (loadingProfile) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted-foreground">Loading profile…</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
        This profile couldn't be found.
      </div>
    );
  }

  const { user, isOwner, iBlockedThem, theyBlockedMe } = profile;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-border bg-card p-8 shadow-soft sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-border">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-muted text-2xl font-semibold uppercase text-muted-foreground">
                {user.name.slice(0, 1)}
              </div>
            )}
          </div>
          {isOwner && (
            <>
              <button
                onClick={handleAvatarPick}
                disabled={uploadingAvatar}
                title="Change profile picture"
                className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-primary-foreground shadow-soft transition-transform hover:scale-105 disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          {user.email && <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Member since {new Date(user.created_at).toLocaleDateString()}
          </p>

          {!isOwner && currentUser && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <button
                onClick={toggleBlock}
                disabled={blockBusy}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 " +
                  (iBlockedThem
                    ? "border-border bg-card text-foreground hover:bg-muted"
                    : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20")
                }
              >
                {iBlockedThem ? (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Unblock {user.name.split(" ")[0]}
                  </>
                ) : (
                  <>
                    <ShieldBan className="h-4 w-4" /> Block {user.name.split(" ")[0]}
                  </>
                )}
              </button>
              {theyBlockedMe && (
                <span className="text-xs text-muted-foreground">
                  Note: this user has blocked you — their new desks won't appear on your dashboard.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">
          {isOwner ? "Your desks" : `${user.name}'s desks`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOwner
            ? "Every desk you've created, including expired and hidden ones."
            : "Desks this user currently has open."}
        </p>

        <div className="mt-6">
          <DeskGrid
            desks={desks}
            loading={loadingDesks}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={() => {
              if (loadingDesks || loadingMore || !hasMore) return;
              loadDesks(offset, false);
            }}
            onJoin={(d) => {
              setJoinTarget(d);
              setIsJoinModalOpen(true);
            }}
            currentUserId={currentUser?.id ?? null}
            onViewJoiners={isOwner ? (d) => setViewJoinersDeskId(d.id) : undefined}
            onEdit={
              isOwner
                ? (d) => {
                    setEditTarget(d);
                    setIsEditModalOpen(true);
                  }
                : undefined
            }
            onDelete={isOwner ? handleDeleteDesk : undefined}
            onToggleHide={isOwner ? handleToggleHide : undefined}
          />
        </div>
      </div>

      <JoinDeskModal
        open={isJoinModalOpen}
        desk={joinTarget}
        onClose={() => setIsJoinModalOpen(false)}
      />
      <JoinersModal
        open={Boolean(viewJoinersDeskId)}
        deskId={viewJoinersDeskId}
        onClose={() => setViewJoinersDeskId(null)}
      />
      <EditDeskModal
        open={isEditModalOpen}
        desk={editTarget}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditSave}
      />
    </div>
  );
}
