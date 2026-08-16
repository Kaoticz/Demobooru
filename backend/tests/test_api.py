"""End-to-end API tests: exercised through the HTTP layer, never internals."""

from pathlib import Path

from app.storage import stored_files

from tests.helpers import TEST_UPLOAD_DIR, make_png, upload


def stored_file_count() -> int:
    return len(stored_files())


# ---------------------------------------------------------------- health ----

def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"


# ---------------------------------------------------------------- upload ----

def test_upload_success_end_to_end(client):
    png = make_png(width=3, height=2, rgb=(10, 20, 30))
    response = upload(client, "cat animal", filename="kitty.png", data=png)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["original_filename"] == "kitty.png"
    assert body["mime_type"] == "image/png"
    assert body["size_bytes"] == len(png)
    assert set(body["tags"]) == {"cat", "animal"}
    assert body["url"].startswith("/api/files/")

    # Disk side effect: one stored file with a generated name, exact bytes.
    files = stored_files()
    assert len(files) == 1
    stored = TEST_UPLOAD_DIR / files[0]
    assert stored.read_bytes() == png
    assert files[0] != "kitty.png"

    # Database side effect: retrievable through list and detail.
    listing = client.get("/api/images").json()
    assert listing["total"] == 1
    assert listing["items"][0]["id"] == body["id"]
    detail = client.get(f"/api/images/{body['id']}").json()
    assert detail["original_filename"] == "kitty.png"


def test_upload_missing_file_rejected(client):
    response = client.post("/api/images", data={"tags": "cat"})
    assert response.status_code == 422
    assert stored_file_count() == 0


def test_upload_non_image_type_rejected(client):
    response = upload(client, "cat", filename="notes.txt",
                      data=b"just some text", content_type="text/plain")
    assert response.status_code == 400
    assert "unsupported file type" in response.json()["detail"]
    assert stored_file_count() == 0


def test_upload_disallowed_image_type_rejected(client):
    response = upload(client, "cat", filename="pic.bmp",
                      data=b"BM...", content_type="image/bmp")
    assert response.status_code == 400
    assert "JPEG, PNG, GIF and WebP" in response.json()["detail"]
    assert stored_file_count() == 0


def test_upload_oversize_rejected(client):
    too_big = make_png() + b"\x00" * (10 * 1024 * 1024 + 1)
    response = upload(client, "cat", data=too_big)
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "too large" in detail and "10 MB" in detail
    assert stored_file_count() == 0


def test_upload_empty_file_rejected(client):
    response = upload(client, "cat", data=b"")
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]
    assert stored_file_count() == 0


def test_upload_without_tags_rejected(client):
    response = upload(client, "")
    assert response.status_code == 400
    assert "at least one tag" in response.json()["detail"]
    assert stored_file_count() == 0


def test_upload_whitespace_tags_rejected(client):
    response = upload(client, "   ")
    assert response.status_code == 400
    assert "at least one tag" in response.json()["detail"]
    assert stored_file_count() == 0


def test_upload_missing_tags_field_rejected(client):
    response = client.post(
        "/api/images",
        files={"file": ("x.png", make_png(), "image/png")},
    )
    assert response.status_code == 400
    assert "at least one tag" in response.json()["detail"]
    assert stored_file_count() == 0


def test_upload_invalid_tag_characters_rejected(client):
    response = upload(client, "cat cute!!")
    assert response.status_code == 400
    assert "'cute!!'" in response.json()["detail"]
    assert stored_file_count() == 0


def test_upload_original_filename_too_long_rejected(client):
    response = upload(client, "cat", filename="n" * 513)
    assert response.status_code == 400
    assert "filename is too long" in response.json()["detail"]
    assert stored_file_count() == 0


# ------------------------------------------------------------------ tags ----

def test_tag_normalization_dedup_and_casing(client):
    response = upload(client, "  Cat cat  DOG_dog ")
    assert response.status_code == 201
    tags = response.json()["tags"]
    assert tags == ["cat", "dog_dog"]  # first-seen order, case-folded, deduped


def test_existing_tag_is_reused_not_duplicated(client):
    first = upload(client, "landscape").json()
    second = upload(client, "Landscape sunset").json()
    assert first["tags"] == ["landscape"]
    assert second["tags"] == ["landscape", "sunset"]

    tag_list = client.get("/api/tags").json()["tags"]
    assert tag_list == ["landscape", "sunset"]  # one 'landscape', not two

    # Searching the shared tag finds both images.
    results = client.get("/api/images?tags=landscape").json()
    assert results["total"] == 2
    assert {item["id"] for item in results["items"]} == {first["id"], second["id"]}


# --------------------------------------------------------- list & search ----

def test_listing_newest_first_with_pagination(client):
    ids = [upload(client, f"tag{i}").json()["id"] for i in range(25)]

    page1 = client.get("/api/images").json()
    assert page1["page"] == 1 and page1["page_size"] == 20
    assert page1["total"] == 25 and page1["total_pages"] == 2
    assert [item["id"] for item in page1["items"]] == list(reversed(ids))[:20]

    page2 = client.get("/api/images?page=2").json()
    assert [item["id"] for item in page2["items"]] == list(reversed(ids))[20:]

    beyond = client.get("/api/images?page=99").json()
    assert beyond["items"] == []
    assert beyond["total"] == 25 and beyond["total_pages"] == 2  # valid metadata


def test_invalid_page_rejected(client):
    assert client.get("/api/images?page=0").status_code == 422


def test_search_single_tag(client):
    upload(client, "cat dog")
    bird_id = upload(client, "cat bird").json()["id"]
    results = client.get("/api/images?tags=bird").json()
    assert results["total"] == 1
    assert results["items"][0]["id"] == bird_id


def test_search_multi_tag_is_intersection(client):
    both = upload(client, "cat dog").json()["id"]
    upload(client, "cat bird")
    upload(client, "dog fish")
    results = client.get("/api/images?tags=cat dog").json()
    assert results["total"] == 1
    assert results["items"][0]["id"] == both


def test_search_normalizes_input(client):
    upload(client, "CAT dog")
    results = client.get("/api/images?tags= Cat  DOG ").json()
    assert results["total"] == 1


def test_search_no_matches_returns_empty_with_metadata(client):
    upload(client, "cat")
    results = client.get("/api/images?tags=zebra").json()
    assert results["items"] == []
    assert results["total"] == 0 and results["total_pages"] == 0
    assert results["page"] == 1 and results["page_size"] == 20


def test_search_nonexistent_tag_returns_empty_not_error(client):
    results = client.get("/api/images?tags=never_seen").json()
    assert results["items"] == [] and results["total"] == 0


def test_search_invalid_tag_syntax_rejected(client):
    assert client.get("/api/images?tags=ok no!pe").status_code == 400


# ---------------------------------------------------------------- detail ----

def test_detail_returns_full_record(client):
    png = make_png(rgb=(1, 2, 3))
    created = upload(client, "alpha beta", filename="photo.jpeg",
                     data=png, content_type="image/jpeg").json()
    detail = client.get(f"/api/images/{created['id']}").json()
    assert detail["id"] == created["id"]
    assert detail["original_filename"] == "photo.jpeg"
    assert detail["mime_type"] == "image/jpeg"
    assert detail["size_bytes"] == len(png)
    assert detail["tags"] == ["alpha", "beta"]
    assert detail["created_at"]


def test_detail_of_nonexistent_image(client):
    response = client.get("/api/images/9999")
    assert response.status_code == 404
    assert "9999" in response.json()["detail"]


# ---------------------------------------------------------------- delete ----

def test_delete_removes_record_and_file(client):
    created = upload(client, "temp").json()
    assert stored_file_count() == 1

    response = client.delete(f"/api/images/{created['id']}")
    assert response.status_code == 204

    assert stored_file_count() == 0
    assert client.get(f"/api/images/{created['id']}").status_code == 404
    assert client.get("/api/images").json()["total"] == 0


def test_delete_of_nonexistent_image(client):
    assert client.delete("/api/images/4242").status_code == 404


def test_delete_cleans_up_orphaned_tags(client):
    upload(client, "keepme onlymine")
    upload(client, "keepme")
    image_to_delete = client.get("/api/images?tags=onlymine").json()["items"][0]

    client.delete(f"/api/images/{image_to_delete['id']}")

    # 'onlymine' lost its only image and must disappear; 'keepme' survives.
    assert client.get("/api/tags").json()["tags"] == ["keepme"]


# ------------------------------------------------------------- tag list -----

def test_tag_list_alphabetical_names_only(client):
    upload(client, "zebra apple mango")
    upload(client, "banana")
    body = client.get("/api/tags").json()
    assert body["tags"] == ["apple", "banana", "mango", "zebra"]
    # Names only: no counts anywhere in the response.
    assert not any(isinstance(v, int) for v in body["tags"])
    assert set(body.keys()) == {"tags"}


def test_tag_list_excludes_unused_tags_after_delete(client):
    upload(client, "solo")
    image_id = client.get("/api/images").json()["items"][0]["id"]
    client.delete(f"/api/images/{image_id}")
    assert client.get("/api/tags").json()["tags"] == []


# ---------------------------------------------------------- file serving ----

def test_file_serving_returns_bytes(client):
    png = make_png(rgb=(9, 9, 9))
    created = upload(client, "serve", data=png).json()
    response = client.get(created["url"])
    assert response.status_code == 200
    assert response.content == png
    assert response.headers["content-type"].startswith("image/png")


def test_file_serving_missing_file_is_404_without_crash(client):
    created = upload(client, "gone").json()
    stored = TEST_UPLOAD_DIR / list(stored_files())[0]
    stored.unlink()  # simulate the file disappearing under the record

    response = client.get(created["url"])
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]

    # And the API as a whole keeps working.
    assert client.get("/api/images").status_code == 200


def test_file_serving_rejects_traversal_names(client):
    for bad in ("../../etc/passwd", "deadbeef.exe", "nice_name.png"):
        response = client.get(f"/api/files/{bad}")
        assert response.status_code == 404
