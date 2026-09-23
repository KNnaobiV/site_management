from dataclasses import dataclass

from typing import Any

@dataclass(frozen=True)
class Scope:
    project: Any = None
    plot: Any = None
    work_item: Any = None
    job_item: Any = None


def get_scope(obj=None, *, project=None, plot=None, work_item=None, job_item=None):
    """
    Resolve the complete construction hierarchy from any related object.
    Explicit arguments take precedence over inferred relationships.
    """
    obj_type = getattr(obj.__class__, "__name__", "")

    if job_item is None and obj is not None:
        if obj_type == "JobItem":
            job_item = obj
        else:
            job_item = getattr(obj, "job_item", None)

    if work_item is None and obj is not None:
        if obj_type == "WorkItem":
            work_item = obj
        elif job_item is not None:
            work_item = getattr(job_item, "work_item", None)
        else:
            work_item = getattr(obj, "work_item", None)

    if plot is None and obj is not None:
        if obj_type == "ConstructionPlot":
            plot = obj
        elif work_item is not None:
            plot = getattr(work_item, "construction_plot", None)
        else:
            plot = getattr(obj, "construction_plot", None) or getattr(obj, "plot", None)

    if project is None and obj is not None:
        if obj_type == "ConstructionProject":
            project = obj
        elif plot is not None:
            project = getattr(plot, "construction_project", None)
        else:
            project = getattr(obj, "project", None)

    return Scope(
        project=project,
        plot=plot,
        work_item=work_item,
        job_item=job_item,
    )


def get_project(obj):
    return get_scope(obj).project


def get_plot(obj):
    return get_scope(obj).plot
