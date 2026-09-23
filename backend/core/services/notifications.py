from core.models import Notification


class NotificationService:
    def __init__(self, *, project=None, plot=None):
        self.project = project
        self.plot = plot

    def project_members(self):
        if not self.project:
            return set()

        members = {
            self.project.created_by,
            self.project.client,
            self.project.project_manager,
        }
        members.update(self.project.consultants.all())

        for plot in self.project.constructionplot_set.all():
            members.update(plot.foremen.all())

        return {member for member in members if member}

    def plot_members(self):
        if not self.plot:
            return set()

        members = set(self.plot.foremen.all())
        project = self.plot.construction_project
        if project:
            members.update({
                project.created_by,
                project.client,
                project.project_manager,
            })
        return {member for member in members if member}

    def create(self, *, user, message, priority=Notification.Priority.NORMAL,
               target_url=""):
        return Notification(
            user=user,
            project=self.project,
            message=message,
            priority=priority,
            target_url=target_url,
        )

    def send_to(self, users, *, message, priority=Notification.Priority.NORMAL,
                target_url="", exclude=None):
        excluded = set(exclude or [])
        notifications = [
            self.create(
                user=user,
                message=message,
                priority=priority,
                target_url=target_url,
            )
            for user in set(users)
            if user and user not in excluded
        ]

        if notifications:
            Notification.objects.bulk_create(notifications)

        return notifications

    def notify_project_members(self, **kwargs):
        return self.send_to(self.project_members(), **kwargs)

    def notify_plot_members(self, **kwargs):
        return self.send_to(self.plot_members(), **kwargs)

    def notify_approvers(self, **kwargs):
        if not self.project:
            return []

        approvers = {
            self.project.created_by,
            self.project.project_manager,
        }
        return self.send_to(approvers, **kwargs)

    def notify_approval(self, obj, actor, *, approved, message="", target_url=""):
        scope = self.plot or getattr(obj, "construction_plot", None)
        name = getattr(obj, "name", None) or getattr(obj, "job_name", "")

        if approved:
            text = f"'{name}' was approved by {actor.username}."
        else:
            text = f"'{name}' was rejected by {actor.username}."

        if message:
            text += f" Reason: {message}"

        return self.notify_plot_members(
            message=text,
            priority=Notification.Priority.NORMAL if approved else Notification.Priority.HIGH,
            target_url=target_url or f"/job-items/{obj.pk}/",
            exclude={actor},
        )
