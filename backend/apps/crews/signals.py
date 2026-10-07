"""Hiring stays decoupled: a referral is created from Application post_save, not from hiring code."""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger("kaamsathi.crews")


@receiver(post_save, sender="hiring.Application")
def application_saved(sender, instance, created, raw=False, **kwargs):
    if raw or instance.stage != "joined":
        return
    from .services import create_referral_for_application

    create_referral_for_application(instance)
