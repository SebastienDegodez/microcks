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
package io.github.microcks.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterRegistration;
import jakarta.servlet.ServletContext;

import java.util.EnumSet;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests of the web configuration of the mock endpoints.
 * @author SebastienDegodez
 */
class WebConfigurationTest {

   /** S27: the Mock URL of the Arazzo workflows has the same CORS policy as the other mock endpoints. */
   @Test
   void theMockUrlsOfTheArazzoWorkflowsHaveTheCorsPolicyOfTheMocks() throws Exception {
      WebConfiguration configuration = new WebConfiguration();
      ReflectionTestUtils.setField(configuration, "env", mock(Environment.class));
      ReflectionTestUtils.setField(configuration, "enableCorsPolicy", true);
      ServletContext servletContext = mock(ServletContext.class);
      FilterRegistration.Dynamic corsFilter = mock(FilterRegistration.Dynamic.class);
      FilterRegistration.Dynamic dynamicCorsFilter = mock(FilterRegistration.Dynamic.class);
      when(servletContext.addFilter(eq("corsFilter"), any(Filter.class))).thenReturn(corsFilter);
      when(servletContext.addFilter(eq("dynamicCorsFilter"), any(Filter.class))).thenReturn(dynamicCorsFilter);

      configuration.onStartup(servletContext);

      verify(dynamicCorsFilter).addMappingForUrlPatterns(
            EnumSet.of(DispatcherType.REQUEST, DispatcherType.FORWARD, DispatcherType.ASYNC), true, "/arazzo/*");
   }
}
