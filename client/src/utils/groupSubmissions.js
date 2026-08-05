// Groups flat submission rows + grade rows into one visual card per
// scholar per calendar month. This is DISPLAY-ONLY grouping — each item
// keeps its own `status`/`staff_comment` and is still reviewed individually
// via /submission/review/:id. Nothing here touches the DB or review logic.

const monthKey = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return 'unknown';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key) => {
    if (key === 'unknown') return 'Undated';
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-PH', {
        month: 'long',
        year: 'numeric',
    });
};

/**
 * @param {Array} submissions - rows from /submission/all
 * @param {Array} grades - rows from /submission/grades/all (optional, Documents tab only)
 * @returns {Array} groups sorted by most recent activity first
 */
export const groupByScholarMonth = (submissions = [], grades = []) => {
    const groups = {};

    const ensureGroup = (scholarId, fullName, dateStr) => {
        const mKey = monthKey(dateStr);
        const groupKey = `${scholarId}__${mKey}`;
        if (!groups[groupKey]) {
            groups[groupKey] = {
                key: groupKey,
                scholar_id: scholarId,
                full_name: fullName,
                periodKey: mKey,
                periodLabel: monthLabel(mKey),
                submissionItems: [],
                gradeItems: [],
                latestDate: dateStr,
            };
        }
        return groups[groupKey];
    };

    submissions.forEach((sub) => {
        const scholarId = sub.scholar_id || sub.sid;
        const group = ensureGroup(scholarId, sub.full_name, sub.submitted_at);
        group.submissionItems.push(sub);
        if (new Date(sub.submitted_at) > new Date(group.latestDate)) {
            group.latestDate = sub.submitted_at;
        }
    });

    grades.forEach((g) => {
        const group = ensureGroup(g.scholar_id, g.full_name, g.submitted_at);
        group.gradeItems.push(g);
        if (new Date(g.submitted_at) > new Date(group.latestDate)) {
            group.latestDate = g.submitted_at;
        }
    });

    return Object.values(groups).sort(
        (a, b) => new Date(b.latestDate) - new Date(a.latestDate)
    );
};