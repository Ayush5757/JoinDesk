import ExcelJS from "exceljs";

// Times in the sheets are written as plain text in the analytics timezone
// (IST by default) so what you read in Excel is exactly what happened.
function fmtExact(iso, offsetMin) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + offsetMin * 60000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
  row.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addTable(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }));
  rows.forEach((r) => sheet.addRow(r));
  styleHeader(sheet);
  return sheet;
}

const ACCESS_LABEL = {
  paid: "Paid",
  trial: "Free trial",
  free_all: "Free (all desks)",
  free_desk: "Free (this desk)",
  open: "Open (paywall off)",
  owner: "Desk owner",
  legacy: "Before tracking",
};

/** Workbook for one desk + one month: Summary / Users / Daily / Join Log. */
export async function deskReportToWorkbook(report, deskEvents, usersById) {
  const off = report.timezoneOffsetMinutes;
  const wb = new ExcelJS.Workbook();
  wb.creator = "JoinDesk";
  wb.created = new Date();

  // ---- Summary
  const t = report.totals;
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Item", key: "k", width: 30 },
    { header: "Value", key: "v", width: 40 },
  ];
  [
    ["Desk", report.desk.title],
    ["Type", report.desk.is_special ? "Special" : "Normal"],
    ["Month", report.month],
    ["Joins this month (1 per person per day)", t.joinsInMonth],
    ["Unique people this month", t.uniqueUsersInMonth],
    ["Days with at least one join", t.activeDays],
    ["All-time joins (1 per person per day)", t.allTimeJoins],
    ["All-time unique people", t.allTimeUniqueUsers],
  ].forEach(([k, v]) => summary.addRow({ k, v }));
  styleHeader(summary);

  // ---- Users (ranked, most active first)
  addTable(
    wb,
    "Users",
    [
      { header: "Rank", key: "rank", width: 7 },
      { header: "Name", key: "name", width: 24 },
      { header: "Email", key: "email", width: 32 },
      { header: "Days joined this month", key: "daysActiveInMonth", width: 22 },
      { header: "Days joined all-time", key: "totalJoins", width: 20 },
      { header: "First join", key: "first", width: 18 },
      { header: "Last join", key: "last", width: 18 },
      { header: "Free access", key: "free", width: 16 },
      { header: "Blocked", key: "blocked", width: 9 },
    ],
    report.users.map((u, i) => ({
      rank: i + 1,
      name: u.name,
      email: u.email,
      joinsInMonth: u.joinsInMonth,
      daysActiveInMonth: u.daysActiveInMonth,
      totalJoins: u.totalJoins,
      first: fmtExact(u.firstJoinAt, off),
      last: fmtExact(u.lastJoinAt, off),
      free: u.freeAccess === "all" ? "All desks" : u.freeAccess === "desk" ? "This desk" : "",
      blocked: u.is_blocked ? "Yes" : "",
    }))
  );

  // ---- Daily
  addTable(
    wb,
    "Daily",
    [
      { header: "Date", key: "date", width: 14 },
      { header: "Joins (people)", key: "joins", width: 16 },
      { header: "Unique people", key: "uniqueUsers", width: 15 },
    ],
    report.daily
  );

  // ---- Join log (this month only)
  const [y, m] = report.month.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, 1) - off * 60000;
  const endMs = Date.UTC(y, m, 1) - off * 60000;
  const logRows = deskEvents
    .filter((e) => {
      const ts = Date.parse(e.joined_at);
      return ts >= startMs && ts < endMs;
    })
    .map((e) => {
      const u = usersById.get(e.user_id);
      return {
        time: fmtExact(e.joined_at, off),
        name: u?.name || "(deleted user)",
        email: u?.email || "",
        access: ACCESS_LABEL[e.access_type] || e.access_type || "",
      };
    })
    .reverse();
  addTable(
    wb,
    "Join Log",
    [
      { header: "Time", key: "time", width: 18 },
      { header: "Name", key: "name", width: 24 },
      { header: "Email", key: "email", width: 32 },
      { header: "How they got in", key: "access", width: 20 },
    ],
    logRows
  );

  return wb.xlsx.writeBuffer();
}

/** Workbook of users with activity + access status (for spotting dead users). */
export async function usersToWorkbook(rows, tzOffsetMinutes) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JoinDesk";
  addTable(
    wb,
    "Users",
    [
      { header: "Name", key: "name", width: 24 },
      { header: "Email", key: "email", width: 32 },
      { header: "Signed up", key: "created", width: 18 },
      { header: "Total joins", key: "totalJoins", width: 12 },
      { header: "Last join", key: "last", width: 18 },
      { header: "Status", key: "status", width: 22 },
      { header: "Access until", key: "until", width: 18 },
      { header: "Free desks", key: "freeDesks", width: 12 },
      { header: "Blocked", key: "blocked", width: 9 },
      { header: "Never joined", key: "never", width: 13 },
    ],
    rows.map((u) => ({
      name: u.name,
      email: u.email,
      created: fmtExact(u.created_at, tzOffsetMinutes),
      totalJoins: u.total_joins || 0,
      last: fmtExact(u.last_join_at, tzOffsetMinutes),
      status:
        { paid: "Paid", trial: "Free trial", free_all: "Free (all desks)", free_desks: "Free (some desks)", expired: "Expired", open: "Open" }[
          u.access.status
        ] || u.access.status,
      until: fmtExact(u.access.until, tzOffsetMinutes),
      freeDesks: u.access.freeAll ? "All" : u.access.freeDeskIds.length || "",
      blocked: u.is_blocked ? "Yes" : "",
      never: (u.total_joins || 0) === 0 ? "Yes" : "",
    }))
  );
  return wb.xlsx.writeBuffer();
}