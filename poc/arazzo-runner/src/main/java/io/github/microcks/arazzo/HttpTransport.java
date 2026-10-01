/*
 * Copyright The Microcks Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.github.microcks.arazzo;

import java.net.URI;
import java.util.List;
import java.util.Map;

/** The port through which steps call APIs. */
public interface HttpTransport {

   /** A request built from a step. A null body means no body. */
   record HttpCall(String method, URI uri, Map<String, String> headers, String body) {
   }

   /** What the API answered. */
   record HttpOutcome(int status, Map<String, List<String>> headers, String body) {
   }

   HttpOutcome send(HttpCall call);
}
