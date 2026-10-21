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
package io.github.microcks.domain;

/**
 * Whether a workflow of an Arazzo document can run against the APIs of Microcks.
 * @param workflowId The id of the workflow in the Arazzo document
 * @param runnable   Whether every source the workflow calls is linked to a Microcks API
 * @author SebastienDegodez
 */
public record ArazzoWorkflowStatus(String workflowId, boolean runnable) {
}
