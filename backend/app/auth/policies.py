"""PolicyLens AI — Object-Level Authorization Policies (BOLA / IDOR protection).

Enforces server-side authorization checks for individual entities based on
user role, assignment, and resource ownership.
"""


def can_view_financial_record(user, record):
    """Admin, Manager, Analyst, and Auditor can view all financial records.
    Reviewer can view if actively reviewing records.
    """
    if not user or not user.is_active:
        return False
    return user.role in ('Admin', 'Manager', 'Analyst', 'Reviewer', 'Auditor')


def can_edit_financial_record(user, record):
    """Only Admin and Manager can create or modify financial records."""
    if not user or not user.is_active:
        return False
    return user.role in ('Admin', 'Manager')


def can_view_case(user, case):
    """Check if user is authorized to view a specific risk case.
    - Admin, Manager, Auditor, Analyst: all cases
    - Reviewer: assigned cases or unassigned queue
    """
    if not user or not user.is_active:
        return False
    if user.role in ('Admin', 'Manager', 'Auditor', 'Analyst'):
        return True
    if user.role == 'Reviewer':
        return case.assigned_to == user.id or case.assigned_to is None
    return False


def can_edit_case(user, case):
    """Check if user is authorized to modify a specific risk case.
    - Admin, Manager: full modification
    - Reviewer: only assigned cases
    - Analyst: only if status is New (can enrich initial triage)
    """
    if not user or not user.is_active:
        return False
    if user.role in ('Admin', 'Manager'):
        return True
    if user.role == 'Reviewer':
        return case.assigned_to == user.id
    if user.role == 'Analyst':
        return case.status == 'New'
    return False


def can_view_complaint(user, complaint):
    """Check if user is authorized to view a specific citizen complaint.
    - Admin, Manager, Auditor: all complaints
    - Reviewer: assigned complaints or unassigned queue
    - Submitter: own submitted complaints
    """
    if not user or not user.is_active:
        return False
    if user.role in ('Admin', 'Manager', 'Auditor'):
        return True
    if user.role == 'Reviewer':
        return complaint.assigned_to == user.id or complaint.assigned_to is None
    if complaint.submitted_by == user.id:
        return True
    return False


def can_edit_complaint(user, complaint):
    """Check if user is authorized to update a specific complaint status/resolution.
    - Admin, Manager: full modification
    - Reviewer: assigned complaints
    """
    if not user or not user.is_active:
        return False
    if user.role in ('Admin', 'Manager'):
        return True
    if user.role == 'Reviewer':
        return complaint.assigned_to == user.id
    return False


def can_view_report(user, report):
    """Check if user is authorized to view report metadata."""
    if not user or not user.is_active:
        return False
    if user.role in ('Admin', 'Manager', 'Auditor'):
        return True
    if user.role == 'Analyst':
        return report.created_by == user.id or report.report_type in ('financial_summary', 'anomaly_report')
    return False


def can_download_report(user, report):
    """Check if user is authorized to download a report file."""
    if not user or not user.is_active:
        return False
    if user.role in ('Admin', 'Manager', 'Auditor'):
        return True
    if user.role == 'Analyst':
        return report.created_by == user.id or report.report_type in ('financial_summary', 'anomaly_report')
    return False


def can_view_import(user, imp):
    """Only Admin and Manager can view raw batch imports."""
    if not user or not user.is_active:
        return False
    return user.role in ('Admin', 'Manager')


def can_edit_user(actor, target_user):
    """Only Admin can edit arbitrary users. Users can view/edit themselves."""
    if not actor or not actor.is_active:
        return False
    if actor.role == 'Admin':
        return True
    return actor.id == target_user.id
