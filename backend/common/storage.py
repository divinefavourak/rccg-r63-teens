"""
Where files that must not be public are kept.

Everything else uploaded (covers, avatars, audio) goes to the public bucket,
readable by anyone with the address. A payment receipt is someone's bank
record, so it goes here instead and is only ever served through an endpoint
that checks who is asking (`payments.views.ReceiptFileView`).
"""
from django.conf import settings
from django.core.files.storage import FileSystemStorage


def private_storage():
    """
    A private R2 bucket when R2 is set up, a folder outside `MEDIA_ROOT`
    otherwise. Set `R2_PRIVATE_BUCKET_NAME` to a bucket with no public
    domain; without it the files share the media bucket, private by ACL and
    under unguessable names, which is weaker if that bucket is public.
    """
    if getattr(settings, 'R2_ACCESS_KEY_ID', None) and getattr(settings, 'R2_ACCOUNT_ID', None):
        from storages.backends.s3boto3 import S3Boto3Storage
        return S3Boto3Storage(
            bucket_name=settings.R2_PRIVATE_BUCKET_NAME or settings.R2_BUCKET_NAME,
            default_acl='private',
            querystring_auth=True,
            custom_domain=None,
            file_overwrite=False,
        )
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT, base_url='/private-media/')
