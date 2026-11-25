"""Verificações isoladas, sem dependências, da Central Jeri Rota."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class InspectHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if "id" in attr:
            self.ids.append(attr["id"])

class CentralVisualTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "atendimento.html").read_text(encoding="utf-8")
        cls.js = (ROOT / "atendimento.js").read_text(encoding="utf-8")
        cls.css = (ROOT / "atendimento-whatsapp.css").read_text(encoding="utf-8")
        cls.parser = InspectHTML()
        cls.parser.feed(cls.html)

    def test_no_duplicate_html_ids(self):
        self.assertEqual(len(cls_ids := self.parser.ids), len(set(cls_ids)))

    def test_all_js_referenced_ids_exist(self):
        refs = set(re.findall(r"\$\('([A-Za-z0-9_-]+)'\)", self.js))
        self.assertEqual(set(), refs - set(self.parser.ids))

    def test_critical_actions_remain(self):
        expected = {"railConversations", "railAlerts", "newConversation",
            "newConversationDialog", "newConversationNumber", "showAlerts", "pushSettings",
            "pushToggle", "pushTest", "search", "reload", "leads", "centralShell",
            "mobileBack", "chatAvatar", "title", "mobileModeLabel", "chatActions",
            "mobileChatOptions", "take", "release", "advancedHeader",
            "messages", "attachmentMenu", "attachmentOptions", "advancedShortcut",
            "message", "send", "mic", "pdf", "audioFile", "sendAudio", "cancelAudio",
            "confirmVoucher", "cancelVoucher", "voucherPreview", "audioPreview",
            "advancedTools", "phone", "openPhone", "templateName", "sendTemplate",
            "consent", "status"}
        self.assertEqual(set(), expected - set(self.parser.ids))

    def test_assets_and_css_balance(self):
        self.assertIn("atendimento-whatsapp.css?v=20261124-1", self.html)
        self.assertIn("atendimento.js?v=20261124-contact-photos-1", self.html)
        self.assertEqual(self.css.count("{"), self.css.count("}"))

    def test_audio_and_server_actions_preserved(self):
        self.assertIn("fetchIncomingAudio(phone, row.id)", self.js)
        self.assertIn("if (onlyAppend && visibleMessageKeys.length === keys.length) return;", self.js)
        for action in ("/central/modo", "/central/audios", "/central/documentos", "/central/modelos"):
            self.assertIn(action, self.js)
        self.assertIn("document.visibilityState === 'visible'", self.js)

    def test_contact_photo_editor_and_authenticated_avatar(self):
        required = {"editContact", "contactEditor", "contactEditorForm",
                    "contactEditorPhoto", "contactEditorInitials", "contactPhotoFile",
                    "removeContactPhoto", "contactNameField", "saveContactEdit",
                    "cancelContactEdit", "closeContactEditor", "contactEditorStatus"}
        self.assertEqual(set(), required - set(self.parser.ids))
        self.assertIn("/central/contatos/", self.js)
        self.assertIn("getSession()", self.js)
        self.assertIn("imageFileToJpeg(file)", self.js)
        self.assertIn("discardContactPhoto(phone)", self.js)
        self.assertIn("getContactPhoto(phone, revision)", self.js)
        self.assertIn("classList.add('has-contact-photo')", self.js)
        self.assertIn("data:image/jpeg;base64,", self.js)
        self.assertIn("20261124-contact-photos-1", self.html)
        # Não é seguro enviar fotos de clientes a hosts públicos.
        self.assertNotIn("storage/v1/object/public", self.js)

    def test_new_conversation_and_menus(self):
        self.assertIn("newChatDialog.showModal()", self.js)
        self.assertIn("toggleAdvancedTools()", self.js)
        self.assertIn("settings.open = !settings.open", self.js)

if __name__ == "__main__":
    unittest.main()
