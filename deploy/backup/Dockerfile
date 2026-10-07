# Nightly PostgreSQL (+ local media) backups with optional encryption and S3-compatible upload.
FROM postgres:16-alpine
RUN apk add --no-cache aws-cli gnupg tzdata \
    && mkdir -p /backups \
    && chown postgres:postgres /backups
COPY --chmod=0755 backup.sh restore.sh schedule.sh /usr/local/bin/
USER postgres
WORKDIR /backups
ENTRYPOINT []
CMD ["/usr/local/bin/schedule.sh"]
