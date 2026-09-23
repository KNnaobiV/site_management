from decimal import Decimal
import datetime
from django.db.models import Sum
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q as db_Q

from finance.models import Expense
from core.permissions import can_view_finance
from core.reports import build_financial_report_pdf, build_financial_report_excel
def get_artisan_name(job_item):
    if not job_item:
        return "-"
    if getattr(job_item, "job_artisan", None) == "Other" and getattr(job_item, "custom_artisan", None):
        return job_item.custom_artisan
    return getattr(job_item, "job_artisan", None) or "-"

class FinancialReportService:
    """Service to handle the logic of generating PDF/Excel financial reports."""
    
    def __init__(self, user, obj):
        self.user = user
        self.obj = obj

    def export(self, request):
        from rest_framework.exceptions import PermissionDenied
        
        if not can_view_finance(self.user, self.obj):
            raise PermissionDenied("You do not have permission to view or export financial reports.")

        obj_type = getattr(self.obj.__class__, "__name__", "")
        
        expenses = Expense.objects.filter(is_deleted=False)
        budget = None
        plot = None
        project = None
        
        if obj_type == "ConstructionProject":
            expenses = expenses.filter(
                db_Q(project=self.obj) |
                db_Q(plot__construction_project=self.obj) |
                db_Q(work_item__construction_plot__construction_project=self.obj) |
                db_Q(job_item__work_item__construction_plot__construction_project=self.obj)
            )
            title = f"Project Financial Report: {self.obj.project_name}"
            prefix = f"project_{self.obj.id}"
            project = self.obj
            entity_level = "project"
            
            # Project doesn't have a direct budget in the same way, but it aggregates plots
            # For simplicity matching original logic:
            has_budget = False
            allocated = Decimal("0.00")
            spent = self.obj.spent_amount
            remaining = None
            currency = "NGN"

        elif obj_type == "ConstructionPlot":
            expenses = expenses.filter(
                db_Q(plot=self.obj) |
                db_Q(work_item__construction_plot=self.obj) |
                db_Q(job_item__work_item__construction_plot=self.obj)
            )
            title = f"Financial Report: {self.obj.plot_name or self.obj.address}"
            prefix = f"plot_{self.obj.id}"
            plot = self.obj
            project = plot.construction_project
            budget = getattr(plot, "plot_budget", None)
            entity_level = "plot"

        elif obj_type == "WorkItem":
            expenses = expenses.filter(
                db_Q(work_item=self.obj) |
                db_Q(job_item__work_item=self.obj)
            )
            title = f"Financial Report: {self.obj.name}"
            prefix = f"workitem_{self.obj.id}"
            plot = self.obj.construction_plot
            project = plot.construction_project
            budget = getattr(self.obj, "work_item_budget", None)
            entity_level = "workitem"

        elif obj_type == "JobItem":
            expenses = expenses.filter(job_item=self.obj)
            title = f"Financial Report: {self.obj.job_name}"
            prefix = f"jobitem_{self.obj.id}"
            plot = self.obj.work_item.construction_plot
            project = plot.construction_project
            budget = getattr(self.obj, "job_item_budget", None)
            entity_level = "jobitem"

        else:
            return Response({"detail": "Unsupported export target."}, status=status.HTTP_400_BAD_REQUEST)

        if obj_type != "ConstructionProject":
            allocated = budget.allocated_amount if budget else Decimal("0.00")
            has_budget = allocated > 0
            spent = self.obj.spent_amount
            remaining = allocated - spent if has_budget else None
            currency = budget.currency if budget else "NGN"

        expenses = expenses.select_related(
            "cost_code", "project", "plot", "work_item", "job_item",
            "job_item__work_item", "job_item__work_item__construction_plot"
        ).order_by('incurred_at', 'created_at')

        itemized_sheet_title = "Itemized Expenses"
        if obj_type in ("ConstructionProject", "ConstructionPlot"):
            itemized_headers = ["Date", "Work Item", "Job Item", "Artisan", "Amount Paid"]
            itemized_rows_xlsx = []
            itemized_rows_pdf = []
            for exp in expenses:
                d_str = exp.incurred_at.isoformat() if hasattr(exp.incurred_at, "isoformat") else str(exp.incurred_at)
                w_str = (
                    exp.work_item.name if exp.work_item else
                    exp.job_item.work_item.name if exp.job_item else
                    "Plot-level"
                )
                j_str = exp.job_item.job_name if exp.job_item else "General"
                artisan_str = get_artisan_name(exp.job_item)

                itemized_rows_xlsx.append([d_str, w_str, j_str, artisan_str, float(exp.amount)])
                itemized_rows_pdf.append([d_str, w_str, j_str, artisan_str, f"{exp.currency} {exp.amount:,.2f}"])
            col_widths = [1.5, 2.0, 2.0, 1.5, 1.5]
        elif obj_type == "WorkItem":
            itemized_headers = ["Date", "Job Item", "Artisan", "Amount Paid"]
            itemized_rows_xlsx = []
            itemized_rows_pdf = []
            for exp in expenses:
                d_str = exp.incurred_at.isoformat() if hasattr(exp.incurred_at, "isoformat") else str(exp.incurred_at)
                j_str = exp.job_item.job_name if exp.job_item else "General"
                artisan_str = get_artisan_name(exp.job_item)
                itemized_rows_xlsx.append([d_str, j_str, artisan_str, float(exp.amount)])
                itemized_rows_pdf.append([d_str, j_str, artisan_str, f"{exp.currency} {exp.amount:,.2f}"])
            col_widths = [1.5, 2.5, 2.5, 1.5]
        else:
            itemized_headers = ["Date", "Artisan", "Amount Paid"]
            itemized_rows_xlsx = []
            itemized_rows_pdf = []
            for exp in expenses:
                d_str = exp.incurred_at.isoformat() if hasattr(exp.incurred_at, "isoformat") else str(exp.incurred_at)
                artisan_str = get_artisan_name(exp.job_item)
                itemized_rows_xlsx.append([d_str, artisan_str, float(exp.amount)])
                itemized_rows_pdf.append([d_str, artisan_str, f"{exp.currency} {exp.amount:,.2f}"])
            col_widths = [1.5, 4.0, 2.5]

        metadata_pairs = [
            ("Project:", project.project_name),
            ("Generated:", datetime.date.today().isoformat()),
            ("Currency:", currency)
        ]
        
        summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
        if has_budget:
            util_pct = (spent / allocated) * 100
            util_str = f"{util_pct:.1f}%"
        else:
            util_str = "N/A"
            
        summary_values = [
            f"{currency} {allocated:,.2f}" if has_budget else "N/A",
            f"{currency} {spent:,.2f}",
            f"{currency} {remaining:,.2f}" if has_budget else "N/A",
            util_str
        ]

        if request.GET.get("format") == "xlsx":
            return build_financial_report_excel(
                header_title=title,
                metadata_pairs=metadata_pairs,
                summary_headers=summary_headers,
                summary_values=summary_values,
                breakdown_title=None,
                breakdown_headers=None,
                breakdown_rows=None,
                itemized_sheet_title=itemized_sheet_title,
                itemized_headers=itemized_headers,
                itemized_rows=itemized_rows_xlsx,
                filename=f"{prefix}_financial_report.xlsx"
            )

        return build_financial_report_pdf(
            title=title,
            metadata_lines=[f"{k} {v}" for k, v in metadata_pairs],
            summary_headers=summary_headers,
            summary_values=summary_values,
            summary_col_widths=[2.0, 2.0, 2.0, 2.0],
            itemized_heading=itemized_sheet_title,
            itemized_headers=itemized_headers,
            itemized_rows=itemized_rows_pdf,
            itemized_col_widths=col_widths,
            filename=f"{prefix}_financial_report.pdf"
        )
