const fs = require("fs");
const path = require("path");

function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".tsx") || f.name.endsWith(".ts")) {
      let c = fs.readFileSync(p, "utf8");
      const n = c
        .replaceAll('href="/employees', 'href="/admin-portal/employees')
        .replaceAll("href={`/employees", "href={`/admin-portal/employees")
        .replaceAll('href="/dashboard"', 'href="/admin-portal/dashboard"')
        .replaceAll('href="/org-chart"', 'href="/admin-portal/org-chart"')
        .replaceAll('href="/departments"', 'href="/admin-portal/departments"')
        .replaceAll('href="/designations"', 'href="/admin-portal/designations"')
        .replaceAll('href="/attendance', 'href="/admin-portal/attendance')
        .replaceAll('href="/leave', 'href="/admin-portal/leave')
        .replaceAll('href="/settings', 'href="/admin-portal/settings')
        .replaceAll('router.push("/employees', 'router.push("/admin-portal/employees')
        .replaceAll("router.push(`/employees", "router.push(`/admin-portal/employees")
        .replaceAll('replace("/employees', 'replace("/admin-portal/employees')
        .replaceAll('replace("/dashboard"', 'replace("/admin-portal/dashboard"')
        .replaceAll('push("/dashboard"', 'push("/admin-portal/dashboard"')
        .replaceAll('redirect("/employees', 'redirect("/admin-portal/employees')
        .replaceAll('redirect("/dashboard"', 'redirect("/admin-portal/dashboard"');
      if (n !== c) {
        fs.writeFileSync(p, n);
        console.log("fixed", p);
      }
    }
  }
}

walk(path.join(__dirname, "../app/admin-portal"));
walk(path.join(__dirname, "../components"));
