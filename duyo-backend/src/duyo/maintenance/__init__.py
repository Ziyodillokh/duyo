"""One-off operational tasks that ship INSIDE the image.

duyo-backend/scripts/ is not rsynced to the server and not copied by the
Dockerfile, so anything living there cannot be run in production. A task an
operator has to run against real data belongs here, where it travels with the
models it depends on.
"""
