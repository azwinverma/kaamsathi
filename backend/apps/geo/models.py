from django.db import models


class Province(models.Model):
    code = models.PositiveSmallIntegerField(primary_key=True)
    name_en = models.CharField(max_length=50)
    name_ne = models.CharField(max_length=50)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code}. {self.name_en}"


class District(models.Model):
    code = models.SlugField(max_length=40, primary_key=True)
    name_en = models.CharField(max_length=60)
    name_ne = models.CharField(max_length=60)
    province = models.ForeignKey(Province, on_delete=models.PROTECT, related_name="districts")

    class Meta:
        ordering = ["province_id", "name_en"]

    def __str__(self):
        return self.name_en
