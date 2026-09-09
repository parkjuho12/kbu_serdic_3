import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import io,json
spec=importlib.util.spec_from_file_location('demo',Path(__file__).with_name('server.py'))
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class ExplainTests(unittest.TestCase):
 def setUp(self):s.CACHE.clear();s.ATTEMPTS.clear()
 def test_unregistered_input_never_reaches_provider(self):
  with patch.object(s,'urlopen') as call:
   with self.assertRaises(s.ServiceError) as err:s.explain('arbitrary-prompt')
   self.assertEqual(err.exception.status,404);call.assert_not_called()
 def test_real_response_cached_and_sensor_values_supplied(self):
  payload={'id':'chatcmpl-test','model':'gpt-test','choices':[{'message':{'content':'관찰 상태입니다.'}}]}
  with patch.dict(s.os.environ,{'OPENAI_API_KEY':'test'}),patch.object(s,'urlopen',return_value=io.BytesIO(json.dumps(payload).encode())) as call:
   first=s.explain('EDC-KBU-04');second=s.explain('EDC-KBU-04')
   self.assertFalse(first['cached']);self.assertTrue(second['cached']);self.assertEqual(first['response_id'],'chatcmpl-test')
   self.assertEqual(call.call_count,1)
   sent=json.loads(call.call_args.args[0].data);self.assertIn('920',sent['messages'][1]['content'])
 def test_failure_not_disguised_as_ai_response(self):
  with patch.dict(s.os.environ,{'OPENAI_API_KEY':'test'}),patch.object(s,'urlopen',side_effect=TimeoutError):
   with self.assertRaises(s.ServiceError) as err:s.explain('EDC-KBU-01')
   self.assertEqual(err.exception.status,502);self.assertFalse(s.CACHE)
if __name__=='__main__':unittest.main()
